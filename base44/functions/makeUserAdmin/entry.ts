import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get the calling user
        const caller = await base44.auth.me();
        if (!caller) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔧 Making user admin:', caller.email, caller.id);

        // Update the caller to be admin using service role
        await base44.asServiceRole.entities.User.update(caller.id, { role: 'admin' });

        console.log('✅ User is now admin!');

        return Response.json({ 
            success: true,
            message: 'You are now an admin!',
            user_id: caller.id,
            email: caller.email
        });

    } catch (error) {
        console.error('❌ Make admin error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});