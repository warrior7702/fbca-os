import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    // Get base URL
    const baseUrl = Deno.env.get('BASE44_APP_URL') || '';
    
    console.log('========================================');
    console.log('🔄 PCO Callback Started');
    console.log('🌐 BASE44_APP_URL:', baseUrl || 'NOT SET');
    
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        console.log('📝 Code:', code ? `${code.slice(0, 20)}...` : 'MISSING');
        console.log('📝 State (user_id):', state || 'MISSING');
        console.log('❌ Error param:', error || 'none');

        // Helper to build redirect URL - NO HASH ROUTING
        const buildRedirectUrl = (params) => {
            const redirectBase = baseUrl || `${url.protocol}//${url.host}`;
            // Use regular routing, not hash-based
            return `${redirectBase}/Settings?${params}`;
        };

        // Handle PCO OAuth error
        if (error) {
            console.error('❌ PCO returned error:', error);
            return Response.redirect(buildRedirectUrl('tab=integrations&error=pco_auth_failed'), 302);
        }

        // Validate required parameters
        if (!code || !state) {
            console.error('❌ Missing required parameters');
            return Response.redirect(buildRedirectUrl('tab=integrations&error=missing_params'), 302);
        }

        console.log('✅ Parameters validated');

        // Create Base44 client
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        // Build redirect URI for PCO
        const redirectUri = baseUrl ? `${baseUrl}/functions/pcoCallback` : `${url.protocol}//${url.host}/functions/pcoCallback`;
        console.log('🔑 Redirect URI:', redirectUri);
        
        // Check environment variables
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        const clientSecret = Deno.env.get('PCO_CLIENT_SECRET');
        
        if (!clientId || !clientSecret) {
            console.error('❌ Missing PCO credentials');
            return Response.redirect(buildRedirectUrl('tab=integrations&error=pco_credentials_missing'), 302);
        }

        console.log('✅ PCO credentials found');
        
        // Exchange code for tokens
        console.log('🔄 Exchanging code for tokens...');
        const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token exchange failed:', tokenResponse.status);
            console.error('❌ Response:', errorText);
            return Response.redirect(buildRedirectUrl('tab=integrations&error=token_exchange_failed'), 302);
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Tokens received');

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // Get PCO Calendar User ID
        console.log('🔄 Fetching PCO Calendar user ID...');
        let pcoCalendarUserId = null;
        try {
            const calendarMeResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            
            if (calendarMeResponse.ok) {
                const calendarMeData = await calendarMeResponse.json();
                pcoCalendarUserId = calendarMeData?.data?.id;
                console.log('✅ PCO Calendar User ID:', pcoCalendarUserId);
            } else {
                console.warn('⚠️ Failed to get Calendar user ID:', calendarMeResponse.status);
            }
        } catch (error) {
            console.warn('⚠️ Error getting Calendar user ID:', error.message);
        }

        // Build update data
        const updateData = {
            pco_access_token: tokens.access_token,
            pco_refresh_token: tokens.refresh_token,
            pco_token_expires_at: expiresAt
        };

        if (pcoCalendarUserId) {
            updateData.pco_user_id = pcoCalendarUserId;
        }

        console.log('💾 Updating user:', state);

        // Update user with tokens using service role
        await base44.asServiceRole.entities.User.update(state, updateData);

        const elapsed = Date.now() - startTime;
        console.log('✅ User updated successfully');
        console.log('⏱️ Total time:', elapsed, 'ms');

        // Redirect to Settings with success - NO HASH
        const successUrl = buildRedirectUrl(`tab=integrations&connected=pco&t=${Date.now()}`);
        console.log('🎉 Success! Redirecting to:', successUrl);
        console.log('========================================');
        
        return Response.redirect(successUrl, 302);

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error('========================================');
        console.error('❌ PCO Callback FATAL ERROR');
        console.error('⏱️ Failed after:', elapsed, 'ms');
        console.error('❌ Error:', error.message);
        console.error('📚 Stack:', error.stack);
        console.error('========================================');
        
        const url = new URL(req.url);
        const redirectBase = baseUrl || `${url.protocol}//${url.host}`;
        // NO HASH - use regular routing
        return Response.redirect(`${redirectBase}/Settings?tab=integrations&error=callback_failed`, 302);
    }
});