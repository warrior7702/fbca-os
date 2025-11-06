import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get current user
        let currentUser;
        try {
            currentUser = await base44.auth.me();
        } catch (authError) {
            console.error('Auth error:', authError);
            return Response.json({ 
                ok: false,
                error: 'Authentication failed: ' + authError.message
            }, { status: 401 });
        }

        if (!currentUser) {
            return Response.json({ 
                ok: false,
                error: 'Not authenticated' 
            }, { status: 401 });
        }

        console.log('🔍 Getting token for user:', currentUser.email);

        // Get full user data with tokens
        let users;
        try {
            users = await base44.asServiceRole.entities.User.filter({ 
                email: currentUser.email 
            });
        } catch (filterError) {
            console.error('Filter error:', filterError);
            return Response.json({ 
                ok: false,
                error: 'Database query failed: ' + filterError.message
            }, { status: 500 });
        }
        
        if (!users || users.length === 0) {
            console.error('User not found in database:', currentUser.email);
            return Response.json({ 
                ok: false,
                error: 'User record not found' 
            }, { status: 404 });
        }
        
        const user = users[0];

        if (!user.pco_access_token) {
            return Response.json({ 
                ok: false,
                error: 'PCO not connected' 
            }, { status: 400 });
        }

        console.log('✅ Found user with PCO token');

        // Check if token needs refresh
        let needsRefresh = false;
        try {
            if (user.pco_token_expires_at) {
                const expiresAt = new Date(user.pco_token_expires_at);
                const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
                needsRefresh = expiresAt <= fiveMinutesFromNow;
            }
        } catch (dateError) {
            console.warn('Error checking expiration:', dateError);
            // If we can't parse the date, assume token is good
            needsRefresh = false;
        }

        // If token is still valid, return it
        if (!needsRefresh) {
            console.log('✅ Token still valid');
            return Response.json({
                ok: true,
                access_token: user.pco_access_token,
                provider: 'calendar',
                expires_at: user.pco_token_expires_at,
                token_user_id: user.pco_user_id || null
            });
        }

        // Need to refresh the token
        console.log('🔄 Token expired, refreshing...');

        if (!user.pco_refresh_token) {
            return Response.json({ 
                ok: false,
                error: 'No refresh token available. Please reconnect PCO.' 
            }, { status: 400 });
        }

        let tokenResponse;
        try {
            tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: user.pco_refresh_token,
                    client_id: Deno.env.get('PCO_CLIENT_ID'),
                    client_secret: Deno.env.get('PCO_CLIENT_SECRET')
                })
            });
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            return Response.json({ 
                ok: false,
                error: 'Failed to contact PCO: ' + fetchError.message
            }, { status: 500 });
        }

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('PCO token refresh failed:', errorText);
            return Response.json({ 
                ok: false,
                error: 'Token refresh failed. Please reconnect PCO.' 
            }, { status: 400 });
        }

        let tokens;
        try {
            tokens = await tokenResponse.json();
        } catch (jsonError) {
            console.error('JSON parse error:', jsonError);
            return Response.json({ 
                ok: false,
                error: 'Invalid response from PCO' 
            }, { status: 500 });
        }

        const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // Update user tokens
        try {
            await base44.asServiceRole.entities.User.update(user.id, {
                pco_access_token: tokens.access_token,
                pco_refresh_token: tokens.refresh_token,
                pco_token_expires_at: newExpiresAt
            });
        } catch (updateError) {
            console.error('Update error:', updateError);
            // Still return the token even if update fails
            console.warn('Failed to save refreshed token, but returning it anyway');
        }

        console.log('✅ Token refreshed successfully');

        return Response.json({
            ok: true,
            access_token: tokens.access_token,
            provider: 'calendar',
            expires_at: newExpiresAt,
            token_user_id: user.pco_user_id || null
        });

    } catch (error) {
        console.error('❌ Unexpected error in getPCOToken:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            ok: false,
            error: 'Unexpected error: ' + error.message
        }, { status: 500 });
    }
});