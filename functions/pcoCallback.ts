import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // Get the app URL from the request origin
        const appUrl = url.origin;

        console.log('🔄 pcoCallback called');
        console.log('📝 App URL:', appUrl);
        console.log('📝 Code:', code ? 'exists' : 'missing');
        console.log('📝 State (user_id):', state);
        console.log('❌ Error:', error);

        if (error) {
            console.error('PCO OAuth error:', error);
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${appUrl}/Settings?error=pco_auth_failed`
                }
            });
        }

        if (!code || !state) {
            console.error('Missing code or state');
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${appUrl}/Settings?error=missing_params`
                }
            });
        }

        const base44 = createClientFromRequest(req);
        
        // Use direct callback (FBCA app registered with this callback URL)
        const redirectUri = `${appUrl}/functions/pcoCallback`;
        
        console.log('🔑 Using redirect URI:', redirectUri);
        console.log('🔑 Client ID exists:', !!Deno.env.get('PCO_CLIENT_ID'));
        console.log('🔑 Client Secret exists:', !!Deno.env.get('PCO_CLIENT_SECRET'));
        
        // Exchange code for tokens
        const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: Deno.env.get('PCO_CLIENT_ID'),
                client_secret: Deno.env.get('PCO_CLIENT_SECRET'),
                redirect_uri: redirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ PCO token exchange failed:', errorText);
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${appUrl}/Settings?error=token_exchange_failed`
                }
            });
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Tokens received successfully');

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // CRITICAL: Get PCO CALENDAR User ID (not People person ID!)
        let pcoCalendarUserId = null;
        try {
            const calendarMeResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            
            if (calendarMeResponse.ok) {
                const calendarMeData = await calendarMeResponse.json();
                pcoCalendarUserId = calendarMeData?.data?.id;
                console.log('✅ Got PCO CALENDAR User ID:', pcoCalendarUserId);
            } else {
                console.error('⚠️ Failed to get Calendar user ID:', calendarMeResponse.status);
            }
        } catch (error) {
            console.error('⚠️ Error getting Calendar user ID:', error);
        }

        // Build update object
        const updateData = {
            pco_access_token: tokens.access_token,
            pco_refresh_token: tokens.refresh_token,
            pco_token_expires_at: expiresAt
        };

        if (pcoCalendarUserId) {
            updateData.pco_user_id = pcoCalendarUserId;
            console.log('📝 Storing Calendar User ID:', pcoCalendarUserId);
        }

        console.log('💾 Updating user:', state);

        // Update user with tokens using service role
        await base44.asServiceRole.entities.User.update(state, updateData);

        console.log('✅ User updated with tokens');

        // Redirect back to Settings page with success message
        return new Response(null, {
            status: 302,
            headers: {
                'Location': `${appUrl}/Settings?tab=integrations&connected=pco`
            }
        });

    } catch (error) {
        console.error('❌ PCO callback error:', error);
        console.error('Stack:', error.stack);
        
        // Try to get app URL from request
        const appUrl = new URL(req.url).origin;
        
        return new Response(null, {
            status: 302,
            headers: {
                'Location': `${appUrl}/Settings?error=callback_failed`
            }
        });
    }
});