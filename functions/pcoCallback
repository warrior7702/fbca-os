import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        console.log('pcoCallback called');
        console.log('Code:', code ? 'exists' : 'missing');
        console.log('State:', state);
        console.log('Error:', error);

        if (error) {
            console.error('PCO OAuth error:', error);
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${Deno.env.get('BASE44_APP_URL')}/Settings?error=pco_auth_failed`
                }
            });
        }

        if (!code || !state) {
            console.error('Missing code or state');
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${Deno.env.get('BASE44_APP_URL')}/Settings?error=missing_params`
                }
            });
        }

        const base44 = createClientFromRequest(req);
        
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
                redirect_uri: `${Deno.env.get('BASE44_APP_URL')}/functions/pcoCallback`
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('PCO token exchange failed:', errorText);
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': `${Deno.env.get('BASE44_APP_URL')}/Settings?error=token_exchange_failed`
                }
            });
        }

        const tokens = await tokenResponse.json();
        console.log('Tokens received successfully');

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

        // Update user with tokens using service role
        await base44.asServiceRole.entities.User.update(state, {
            pco_access_token: tokens.access_token,
            pco_refresh_token: tokens.refresh_token,
            pco_token_expires_at: expiresAt
        });

        console.log('User updated with tokens');

        // Redirect back to Settings page with success message
        return new Response(null, {
            status: 302,
            headers: {
                'Location': `${Deno.env.get('BASE44_APP_URL')}/Settings?connected=pco`
            }
        });

    } catch (error) {
        console.error('PCO callback error:', error);
        return new Response(null, {
            status: 302,
            headers: {
                'Location': `${Deno.env.get('BASE44_APP_URL')}/Settings?error=callback_failed`
            }
        });
    }
});