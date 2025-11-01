import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔍 Force Admin Role - Starting...');
        
        // Get current user
        const me = await base44.auth.me();
        console.log('📋 Current user:', me.email, 'ID:', me.id);
        console.log('📋 Current role:', me.role);
        
        // Update role using auth.updateMe (for built-in User entity)
        console.log('💾 Updating role to admin...');
        await base44.auth.updateMe({ role: 'admin' });
        
        // Verify the update by fetching user again
        const updated = await base44.auth.me();
        console.log('✅ Updated user role:', updated.role);
        
        return Response.json({ 
            success: true,
            message: 'Role updated to admin',
            user_id: me.id,
            email: me.email,
            old_role: me.role,
            new_role: updated.role
        });

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('❌ Stack:', error.stack);
        return Response.json({ 
            error: error.message,
            stack: error.stack,
            details: 'Failed to update role. Make sure role field exists in User entity.'
        }, { status: 500 });
    }
});