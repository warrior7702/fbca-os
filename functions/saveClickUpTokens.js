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
        
        // Log EVERYTHING we receive
        console.log('Full ClickUp request body:', JSON.stringify(body, null, 2));

        const { user_id, access_token, expires_at, provider } = body;

        if (!user_id || !access_token) {
            console.error('Missing user_id or access_token');
            return Response.json({ 
                error: 'Missing required fields',
                received: body
            }, { status: 400, headers: cors });
        }

        const base44 = createClientFromRequest(req);

        // Set expires_at with a default if missing (ClickUp tokens don't expire)
        const tokenExpiresAt = expires_at || new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString();

        console.log('Updating user:', user_id, 'with expires_at:', tokenExpiresAt);

        await base44.asServiceRole.entities.User.update(user_id, {
            clickup_access_token: access_token,
            clickup_token_expires_at: tokenExpiresAt
        });

        console.log('ClickUp tokens saved successfully');

        return Response.json({ 
            success: true,
            message: 'ClickUp tokens saved'
        }, { headers: cors });

    } catch (error) {
        console.error('Save ClickUp tokens error:', error.message, error.stack);
        return Response.json({ 
            error: error.message
        }, { status: 500, headers: cors });
    }
});