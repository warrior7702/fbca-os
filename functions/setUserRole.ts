import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const caller = await base44.auth.me();
        if (!caller) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { user_id, role } = body;

        console.log('📝 Request to change role:', { user_id, role, caller_email: caller.email });

        if (!user_id || !role) {
            return Response.json({ error: 'user_id and role required' }, { status: 400 });
        }

        if (!['admin', 'user', 'super_user'].includes(role)) {
            return Response.json({ error: 'role must be "admin", "user", or "super_user"' }, { status: 400 });
        }

        const isSelf = caller.id === user_id;
        const isAdminOrSuper = caller.role === 'admin' || caller.role === 'super_user';

        if (!isSelf && !isAdminOrSuper) {
            return Response.json({ 
                error: 'Only admins and super users can change other users roles' 
            }, { status: 403 });
        }

        if (role === 'super_user' && caller.role !== 'super_user' && caller.role !== 'admin' && !isSelf) {
            return Response.json({ 
                error: 'Only admins and super users can grant super user access' 
            }, { status: 403 });
        }

        console.log(`🔄 Setting user ${user_id} role to: ${role}`);

        await base44.asServiceRole.entities.User.update(user_id, { role });

        console.log('✅ Role updated successfully');

        return Response.json({ 
            success: true,
            message: `User role updated to ${role}`,
            new_role: role
        });

    } catch (error) {
        console.error('❌ Set user role error:', error);
        return Response.json({ 
            error: error.message,
            details: error.stack
        }, { status: 500 });
    }
});