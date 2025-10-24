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
        console.log('ClickUp save request:', { user_id: body.user_id, has_token: !!body.access_token });

        const { user_id, access_token, expires_at } = body;

        if (!user_id || !access_token || !expires_at) {
            console.error('Missing required fields');
            return Response.json({ 
                error: 'Missing required fields',
                received: { user_id: !!user_id, access_token: !!access_token, expires_at: !!expires_at }
            }, { status: 400, headers: cors });
        }

        const base44 = createClientFromRequest(req);

        // Use service role to update user (OAuth callback from Vercel)
        await base44.asServiceRole.entities.User.update(user_id, {
            clickup_access_token: access_token,
            clickup_token_expires_at: expires_at
        });

        console.log('ClickUp tokens saved successfully for user:', user_id);

        return Response.json({ 
            success: true,
            message: 'ClickUp tokens saved'
        }, { headers: cors });

    } catch (error) {
        console.error('Save ClickUp tokens error:', error.message);
        return Response.json({ 
            error: error.message
        }, { status: 500, headers: cors });
    }
});