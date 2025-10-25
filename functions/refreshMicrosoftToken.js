import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.microsoft_refresh_token) {
            return Response.json({ error: 'No refresh token available' }, { status: 400 });
        }

        // Check if token needs refresh (within 5 minutes of expiry)
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

        if (expiresAt > fiveMinutesFromNow) {
            return Response.json({ 
                message: 'Token still valid',
                access_token: user.microsoft_access_token 
            });
        }

        // Refresh the token
        const tenantId = 'common';
        const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: user.microsoft_refresh_token,
                client_id: Deno.env.get('MICROSOFT_CLIENT_ID'),
                client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET'),
                scope: 'https://graph.microsoft.com/.default offline_access'
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Microsoft token refresh failed:', errorText);
            return Response.json({ error: 'Token refresh failed' }, { status: 500 });
        }

        const tokens = await tokenResponse.json();
        const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // Update user tokens
        await base44.auth.updateMe({
            microsoft_access_token: tokens.access_token,
            microsoft_refresh_token: tokens.refresh_token || user.microsoft_refresh_token,
            microsoft_token_expires_at: newExpiresAt
        });

        return Response.json({ 
            message: 'Token refreshed successfully',
            access_token: tokens.access_token
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});