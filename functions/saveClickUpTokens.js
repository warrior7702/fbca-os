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

        const { user_id, access_token, expires_at } = await req.json();

        if (!user_id || !access_token || !expires_at) {
            return Response.json({ 
                error: 'Missing required fields' 
            }, { status: 400, headers: cors });
        }

        const base44 = createClientFromRequest(req);

        await base44.asServiceRole.entities.User.update(user_id, {
            clickup_access_token: access_token,
            clickup_token_expires_at: expires_at
        });

        return Response.json({ 
            success: true 
        }, { headers: cors });

    } catch (error) {
        console.error('Save ClickUp tokens error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});