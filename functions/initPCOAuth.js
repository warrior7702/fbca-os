import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const state = url.searchParams.get('state');

        if (!state) {
            return Response.json({ error: 'Missing state parameter' }, { status: 400 });
        }

        const appUrl = Deno.env.get('BASE44_APP_URL');
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        const redirectUri = `${appUrl}/functions/pcoCallback`;
        const scope = 'calendar';
        
        const authUrl = `https://api.planningcenteronline.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
        
        return new Response(null, {
            status: 302,
            headers: {
                'Location': authUrl
            }
        });

    } catch (error) {
        console.error('PCO auth init error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});