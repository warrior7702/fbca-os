import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const cors = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        const body = await req.json();
        console.log('Microsoft save request:', { user_id: body.user_id, has_token: !!body.access_token });

        const { user_id, access_token, refresh_token, expires_at } = body;

        if (!user_id || !access_token) {
            console.error('Missing user_id or access_token');
            return Response.json({ 
                error: 'Missing required fields',
                received: { user_id: !!user_id, access_token: !!access_token, refresh_token: !!refresh_token, expires_at: !!expires_at }
            }, { status: 400, headers: cors });
        }

        const base44 = createClientFromRequest(req);

        const tokenExpiresAt = expires_at || new Date(Date.now() + (3600 * 1000)).toISOString();

        await base44.asServiceRole.entities.User.update(user_id, {
            microsoft_access_token: access_token,
            microsoft_refresh_token: refresh_token || null,
            microsoft_token_expires_at: tokenExpiresAt
        });

        console.log('Microsoft tokens saved successfully');

        return Response.json({ 
            success: true,
            message: 'Microsoft tokens saved'
        }, { headers: cors });

    } catch (error) {
        console.error('Save Microsoft tokens error:', error.message);
        return Response.json({ 
            error: error.message
        }, { status: 500, headers: cors });
    }
});