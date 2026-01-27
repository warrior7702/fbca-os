import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve((req) => {
    try {
        const url = new URL(req.url);
        const state = url.searchParams.get('state');

        console.log('initPCOAuth called with state:', state);

        if (!state) {
            console.error('Missing state parameter');
            return Response.json({ error: 'Missing state parameter' }, { status: 400 });
        }

        const appUrl = Deno.env.get('BASE44_APP_URL');
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        
        console.log('App URL:', appUrl);
        console.log('Client ID exists:', !!clientId);

        if (!appUrl) {
            return Response.json({ error: 'BASE44_APP_URL not configured' }, { status: 500 });
        }

        if (!clientId) {
            return Response.json({ error: 'PCO_CLIENT_ID not configured' }, { status: 500 });
        }

        const redirectUri = `${appUrl}/functions/pcoCallback`;
        const scope = 'calendar resources';
        
        const authUrl = `https://api.planningcenteronline.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
        
        console.log('Redirecting to:', authUrl);
        
        return new Response(null, {
            status: 302,
            headers: {
                'Location': authUrl
            }
        });

    } catch (error) {
        console.error('PCO auth init error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});