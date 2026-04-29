import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const code = body.code;

        if (!code) {
            return Response.json({ error: 'Missing authorization code' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);
        const tenantId = "YOUR_TENANT_ID";
        const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
        const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
        const redirectUri = `${Deno.env.get("BASE44_APP_URL")}/auth/microsoft/callback`;

        // Exchange code for tokens
        const tokenResponse = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                    scope: 'openid profile email User.Read offline_access'
                })
            }
        );

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            return Response.json({ error: 'Token exchange failed' }, { status: 500 });
        }

        const tokens = await tokenResponse.json();

        // Get user info from Microsoft
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        if (!userResponse.ok) {
            return Response.json({ error: 'Failed to get user info' }, { status: 500 });
        }

        const msUser = await userResponse.json();

        // Check if user exists in Base44
        const existingUsers = await base44.asServiceRole.entities.User.filter({
            email: msUser.mail || msUser.userPrincipalName
        });

        let base44User;
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        if (existingUsers.length > 0) {
            // Update existing user with tokens
            base44User = existingUsers[0];
            await base44.asServiceRole.entities.User.update(base44User.id, {
                microsoft_access_token: tokens.access_token,
                microsoft_refresh_token: tokens.refresh_token,
                microsoft_token_expires_at: expiresAt
            });
        } else {
            // Create new user
            base44User = await base44.asServiceRole.entities.User.create({
                email: msUser.mail || msUser.userPrincipalName,
                full_name: msUser.displayName,
                role: 'user', // Default role, can be customized
                microsoft_access_token: tokens.access_token,
                microsoft_refresh_token: tokens.refresh_token,
                microsoft_token_expires_at: expiresAt
            });
        }

        // Create Base44 session for this user
        // NOTE: This requires Base44 to support programmatic login
        // You may need to contact Base44 support for this capability

        return Response.json({ 
            success: true,
            user: {
                id: base44User.id,
                email: base44User.email,
                name: base44User.full_name
            }
        });

    } catch (error) {
        console.error('SSO completion error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});