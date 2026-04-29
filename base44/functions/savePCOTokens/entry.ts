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

        console.log('savePCOTokens called');
        console.log('user_id:', user_id);
        console.log('user_id type:', typeof user_id);

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

        // Use filter instead of get - more reliable
        console.log('Looking up user with filter...');
        const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
        
        if (!users || users.length === 0) {
            console.error('User not found with ID:', user_id);
            return Response.json({ 
                error: 'User not found',
                user_id_received: user_id,
                suggestion: 'User ID does not exist in Base44'
            }, { 
                status: 404, 
                headers: corsHeaders 
            });
        }

        const existingUser = users[0];
        console.log('User found:', existingUser.email);

        // Update the user tokens
        await base44.asServiceRole.entities.User.update(user_id, {
            pco_access_token: access_token,
            pco_refresh_token: refresh_token,
            pco_token_expires_at: expires_at
        });

        console.log('Tokens saved successfully for user:', existingUser.email);

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