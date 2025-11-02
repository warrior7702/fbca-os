import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return {
            access_token: user.pco_access_token,
            expires_at: user.pco_token_expires_at
        };
    }

    console.log('Token expired, refreshing...');

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
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

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('PCO token refresh failed:', errorText);
        throw new Error('Token refresh failed');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
    });

    return {
        access_token: tokens.access_token,
        expires_at: newExpiresAt
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ 
                ok: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        // Get full user data with service role to access tokens
        let users;
        try {
            users = await base44.asServiceRole.entities.User.filter({ 
                email: currentUser.email 
            });
        } catch (filterError) {
            console.error('Error filtering users:', filterError);
            return Response.json({ 
                ok: false,
                error: 'Database error: ' + filterError.message
            }, { status: 500 });
        }
        
        if (!users || users.length === 0) {
            return Response.json({ 
                ok: false,
                error: 'User not found' 
            }, { status: 404 });
        }
        
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                ok: false,
                error: 'PCO not connected' 
            }, { status: 400 });
        }

        // Refresh token if needed
        const { access_token, expires_at } = await refreshTokenIfNeeded(base44, user);

        // Return token without trying to fetch user ID for now
        // (We can add that back later if needed, but it's causing issues)
        return Response.json({
            ok: true,
            access_token: access_token,
            provider: 'calendar',
            expires_at: expires_at,
            token_user_id: user.pco_user_id || null // Return it if we have it saved
        });

    } catch (error) {
        console.error('Get PCO token error:', error);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            ok: false,
            error: error.message || String(error)
        }, { status: 500 });
    }
});