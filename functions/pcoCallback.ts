import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        console.log('🔄 pcoCallback called');
        console.log('📝 Code:', code ? 'exists' : 'missing');
        console.log('📝 State (user_id):', state);
        console.log('❌ Error:', error);

        // Always use the BASE44_APP_URL from environment (it's set as a secret)
        const baseUrl = Deno.env.get('BASE44_APP_URL');
        console.log('🌐 Base URL:', baseUrl);

        // Ensure baseUrl doesn't have trailing slash
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        
        if (error) {
            console.error('PCO OAuth error:', error);
            const redirectUrl = `${cleanBaseUrl}/Settings?tab=integrations&error=pco_auth_failed`;
            console.log('🔗 Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 302);
        }

        if (!code || !state) {
            console.error('Missing code or state');
            const redirectUrl = `${cleanBaseUrl}/Settings?tab=integrations&error=missing_params`;
            console.log('🔗 Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 302);
        }

        const base44 = createClientFromRequest(req);
        
        // Use the BASE44_APP_URL for redirect URI
        const redirectUri = `${cleanBaseUrl}/functions/pcoCallback`;
        
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
            const redirectUrl = `${cleanBaseUrl}/Settings?tab=integrations&error=token_exchange_failed`;
            console.log('🔗 Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 302);
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
        const redirectUrl = `${cleanBaseUrl}/Settings?tab=integrations&connected=pco`;
        console.log('🎉 Success! Redirecting to:', redirectUrl);
        
        return Response.redirect(redirectUrl, 302);

    } catch (error) {
        console.error('❌ PCO callback error:', error);
        console.error('Stack:', error.stack);
        
        const baseUrl = (Deno.env.get('BASE44_APP_URL') || '').replace(/\/$/, '');
        const redirectUrl = `${baseUrl}/Settings?tab=integrations&error=callback_failed`;
        console.log('🔗 Error redirect to:', redirectUrl);
        return Response.redirect(redirectUrl, 302);
    }
});