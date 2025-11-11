import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Helper function to create HTML error page
function createErrorPage(errorMessage, redirectUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>PCO Connection Issue</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            text-align: center;
        }
        h1 { color: #e53e3e; margin-bottom: 1rem; }
        p { color: #4a5568; line-height: 1.6; margin-bottom: 2rem; }
        button {
            background: #4299e1;
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: #3182ce; }
        .error-code {
            background: #fed7d7;
            color: #c53030;
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.875rem;
            margin-bottom: 2rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚠️ Connection Issue</h1>
        <p>${errorMessage}</p>
        <button onclick="window.location.href='${redirectUrl}'">
            Return to Settings
        </button>
    </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        console.log('========================================');
        console.log('🔄 PCO Callback Started');
        console.log('⏰ Time:', new Date().toISOString());
        console.log('📝 Code:', code ? `${code.slice(0, 20)}...` : 'MISSING');
        console.log('📝 State (user_id):', state || 'MISSING');
        console.log('❌ Error param:', error || 'none');

        // Get base URL
        const baseUrl = (Deno.env.get('BASE44_APP_URL') || '').replace(/\/$/, '');
        console.log('🌐 Base URL:', baseUrl);

        if (!baseUrl) {
            console.error('❌ BASE44_APP_URL not set!');
            return new Response(
                createErrorPage(
                    'Configuration error: BASE44_APP_URL not set. Please contact support.',
                    '/Settings'
                ),
                { status: 500, headers: { 'Content-Type': 'text/html' } }
            );
        }

        const settingsUrl = `${baseUrl}/Settings?tab=integrations`;
        
        // Handle PCO OAuth error
        if (error) {
            console.error('❌ PCO returned error:', error);
            const redirectUrl = `${settingsUrl}&error=pco_auth_failed`;
            console.log('🔗 Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 302);
        }

        // Validate required parameters
        if (!code || !state) {
            console.error('❌ Missing required parameters');
            console.error('  - Code:', !!code);
            console.error('  - State:', !!state);
            const redirectUrl = `${settingsUrl}&error=missing_params`;
            console.log('🔗 Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 302);
        }

        console.log('✅ Parameters validated');

        // Create Base44 client
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        // Build redirect URI
        const redirectUri = `${baseUrl}/functions/pcoCallback`;
        console.log('🔑 Redirect URI:', redirectUri);
        
        // Check environment variables
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        const clientSecret = Deno.env.get('PCO_CLIENT_SECRET');
        
        if (!clientId || !clientSecret) {
            console.error('❌ Missing PCO credentials');
            console.error('  - Client ID:', !!clientId);
            console.error('  - Client Secret:', !!clientSecret);
            return new Response(
                createErrorPage(
                    'Configuration error: PCO credentials not configured. Please contact support.',
                    settingsUrl
                ),
                { status: 500, headers: { 'Content-Type': 'text/html' } }
            );
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
            return new Response(
                createErrorPage(
                    `Failed to connect to Planning Center (Error ${tokenResponse.status}). Please try again or contact support if the problem persists.`,
                    `${settingsUrl}&error=token_exchange_failed`
                ),
                { status: 200, headers: { 'Content-Type': 'text/html' } }
            );
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Tokens received');
        console.log('  - Access token:', tokens.access_token ? 'exists' : 'missing');
        console.log('  - Refresh token:', tokens.refresh_token ? 'exists' : 'missing');
        console.log('  - Expires in:', tokens.expires_in, 'seconds');

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
        console.log('📊 Update data keys:', Object.keys(updateData));

        // Update user with tokens using service role
        await base44.asServiceRole.entities.User.update(state, updateData);

        const elapsed = Date.now() - startTime;
        console.log('✅ User updated successfully');
        console.log('⏱️ Total time:', elapsed, 'ms');

        // Redirect to Settings with success
        const successUrl = `${settingsUrl}&connected=pco&t=${Date.now()}`;
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
        
        const baseUrl = (Deno.env.get('BASE44_APP_URL') || '').replace(/\/$/, '');
        const settingsUrl = `${baseUrl}/Settings?tab=integrations`;
        
        return new Response(
            createErrorPage(
                `An unexpected error occurred: ${error.message}. Please try again or contact support.`,
                `${settingsUrl}&error=callback_failed`
            ),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    }
});