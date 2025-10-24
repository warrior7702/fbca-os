import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        // Allow CORS from Vercel
        const cors = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        const { user_id, access_token, refresh_token, expires_at } = await req.json();

        if (!user_id || !access_token || !refresh_token || !expires_at) {
            return Response.json({ 
                error: 'Missing required fields' 
            }, { status: 400, headers: cors });
        }

        const base44 = createClientFromRequest(req);

        // Use service role to update user (since this is called from Vercel, not from user session)
        await base44.asServiceRole.entities.User.update(user_id, {
            pco_access_token: access_token,
            pco_refresh_token: refresh_token,
            pco_token_expires_at: expires_at
        });

        return Response.json({ 
            success: true 
        }, { headers: cors });

    } catch (error) {
        console.error('Save PCO tokens error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});