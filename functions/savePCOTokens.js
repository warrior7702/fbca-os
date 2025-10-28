import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow POST
    if (req.method !== "POST") {
        return Response.json({ 
            error: 'Method Not Allowed. Use POST.' 
        }, { 
            status: 405, 
            headers: corsHeaders 
        });
    }

    try {
        const { user_id, access_token, refresh_token, expires_at } = await req.json();

        console.log('savePCOTokens called for user:', user_id);

        if (!user_id || !access_token || !refresh_token || !expires_at) {
            return Response.json({ 
                error: 'Missing required fields',
                received: { user_id: !!user_id, access_token: !!access_token, refresh_token: !!refresh_token, expires_at: !!expires_at }
            }, { 
                status: 400, 
                headers: corsHeaders 
            });
        }

        const base44 = createClientFromRequest(req);

        // Use service role to update user (since this is called from Vercel, not from user session)
        await base44.asServiceRole.entities.User.update(user_id, {
            pco_access_token: access_token,
            pco_refresh_token: refresh_token,
            pco_token_expires_at: expires_at
        });

        console.log('Tokens saved successfully for user:', user_id);

        return Response.json({ 
            success: true 
        }, { 
            headers: corsHeaders 
        });

    } catch (error) {
        console.error('Save PCO tokens error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { 
            status: 500, 
            headers: corsHeaders 
        });
    }
});