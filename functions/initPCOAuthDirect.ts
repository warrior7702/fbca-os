import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Direct PCO OAuth flow using PCO_CLIENT_ID
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        
        // Get base URL from environment or infer from request
        const url = new URL(req.url);
        const baseUrl = Deno.env.get('BASE44_APP_URL') || `${url.protocol}//${url.host}`;
        const redirectUri = `${baseUrl}/functions/pcoCallback`;
        
        console.log('🔗 Initiating PCO OAuth with:');
        console.log('  - Client ID:', clientId?.slice(0, 20) + '...');
        console.log('  - Base URL:', baseUrl);
        console.log('  - Redirect URI:', redirectUri);
        console.log('  - User ID (state):', user.id);

        if (!clientId) {
            return Response.json({ 
                error: 'PCO_CLIENT_ID not configured' 
            }, { status: 500 });
        }

        // Build PCO authorization URL
        const authUrl = new URL('https://api.planningcenteronline.com/oauth/authorize');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'calendar people');
        authUrl.searchParams.set('state', user.id); // User ID for callback

        console.log('✅ Authorization URL:', authUrl.toString());

        return Response.json({
            ok: true,
            auth_url: authUrl.toString()
        });

    } catch (error) {
        console.error('❌ Init auth error:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});