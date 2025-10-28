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

        // First, verify the user exists
        console.log('Checking if user exists...');
        let existingUser;
        try {
            existingUser = await base44.asServiceRole.entities.User.get(user_id);
            console.log('User found:', existingUser.email);
        } catch (error) {
            console.error('User lookup failed:', error.message);
            
            // Try to find user by filtering all users (in case ID format is wrong)
            console.log('Attempting to find user by filtering...');
            const allUsers = await base44.asServiceRole.entities.User.list();
            console.log('Total users in system:', allUsers.length);
            console.log('First 3 user IDs:', allUsers.slice(0, 3).map(u => ({ id: u.id, email: u.email })));
            
            return Response.json({ 
                error: 'User not found',
                user_id_received: user_id,
                suggestion: 'Check that the user ID from the frontend matches the Base44 user ID format'
            }, { 
                status: 404, 
                headers: corsHeaders 
            });
        }

        // Use service role to update user
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