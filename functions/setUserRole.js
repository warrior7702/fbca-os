import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify caller is authenticated
        const caller = await base44.auth.me();
        if (!caller) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { user_id, role } = body;

        if (!user_id || !role) {
            return Response.json({ error: 'user_id and role required' }, { status: 400 });
        }

        if (!['admin', 'user'].includes(role)) {
            return Response.json({ error: 'role must be "admin" or "user"' }, { status: 400 });
        }

        // Allow users to make themselves admin (for initial setup)
        // OR require caller to be admin to change others
        const isSelf = caller.id === user_id;
        const isAdmin = caller.role === 'admin';

        if (!isSelf && !isAdmin) {
            return Response.json({ 
                error: 'Only admins can change other users roles' 
            }, { status: 403 });
        }

        console.log(`Setting user ${user_id} role to: ${role}`);

        // Update user role using service role
        await base44.asServiceRole.entities.User.update(user_id, { role });

        console.log('✅ Role updated successfully');

        return Response.json({ 
            success: true,
            message: `User role updated to ${role}`
        });

    } catch (error) {
        console.error('Set user role error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});