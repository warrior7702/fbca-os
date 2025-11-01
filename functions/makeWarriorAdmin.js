import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find warrior7702@gmail.com user
        const users = await base44.asServiceRole.entities.User.filter({
            email: 'warrior7702@gmail.com'
        });
        
        console.log('Found users:', users);
        
        if (users.length === 0) {
            return Response.json({ 
                error: 'User not found',
                message: 'warrior7702@gmail.com not found in database'
            }, { status: 404 });
        }
        
        const user = users[0];
        console.log('Current user:', user);
        console.log('Current role:', user.role);
        
        // Update to super_user
        await base44.asServiceRole.entities.User.update(user.id, {
            role: 'super_user'
        });
        
        console.log('✅ Updated to super_user');
        
        return Response.json({ 
            success: true,
            message: 'warrior7702@gmail.com is now a Super User',
            user_id: user.id,
            old_role: user.role,
            new_role: 'super_user'
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});