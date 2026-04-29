import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🚀 setUserRole function started');
    
    try {
        console.log('1️⃣ Creating Base44 client...');
        const base44 = createClientFromRequest(req);
        
        console.log('2️⃣ Getting caller info...');
        const caller = await base44.auth.me();
        console.log('👤 Caller:', { id: caller?.id, email: caller?.email, role: caller?.role });
        
        if (!caller) {
            console.log('❌ No caller found - unauthorized');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('3️⃣ Parsing request body...');
        const body = await req.json();
        const { user_id, role } = body;
        console.log('📝 Request to change role:', { user_id, role, caller_email: caller.email, caller_role: caller.role });

        if (!user_id || !role) {
            console.log('❌ Missing user_id or role');
            return Response.json({ error: 'user_id and role required' }, { status: 400 });
        }

        if (!['admin', 'user', 'super_user'].includes(role)) {
            console.log('❌ Invalid role:', role);
            return Response.json({ error: 'role must be "admin", "user", or "super_user"' }, { status: 400 });
        }

        console.log('4️⃣ Checking permissions...');
        const isSelf = caller.id === user_id;
        const isAdminOrSuper = caller.role === 'admin' || caller.role === 'super_user';
        console.log('🔐 Permission check:', { isSelf, isAdminOrSuper, callerRole: caller.role });

        if (!isSelf && !isAdminOrSuper) {
            console.log('❌ Permission denied - not admin/super user');
            return Response.json({ 
                error: 'Only admins and super users can change other users roles' 
            }, { status: 403 });
        }

        if (role === 'super_user' && caller.role !== 'super_user' && caller.role !== 'admin' && !isSelf) {
            console.log('❌ Permission denied - cannot grant super user');
            return Response.json({ 
                error: 'Only admins and super users can grant super user access' 
            }, { status: 403 });
        }

        console.log(`5️⃣ Updating user ${user_id} role to: ${role}`);
        
        try {
            await base44.asServiceRole.entities.User.update(user_id, { role });
            console.log('✅ Database update successful');
        } catch (dbError) {
            console.error('❌ Database update failed:', dbError);
            throw new Error(`Database update failed: ${dbError.message}`);
        }

        console.log('✅ Role updated successfully - returning response');

        return Response.json({ 
            success: true,
            message: `User role updated to ${role}`,
            new_role: role
        });

    } catch (error) {
        console.error('❌❌❌ FATAL ERROR in setUserRole:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: error.message || 'Unknown error',
            details: error.stack,
            type: error.name
        }, { status: 500 });
    }
});