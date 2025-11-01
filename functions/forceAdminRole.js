import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔍 Force Admin Role - Starting...');
        
        // Get current user
        const me = await base44.auth.me();
        console.log('📋 Current user:', me.email, 'ID:', me.id);
        console.log('📋 Current role:', me.role);
        
        // Force update to admin using service role
        console.log('💾 Updating role to admin...');
        await base44.asServiceRole.entities.User.update(me.id, { 
            role: 'admin' 
        });
        
        // Verify the update
        const updated = await base44.asServiceRole.entities.User.filter({ id: me.id });
        console.log('✅ Updated user:', updated[0]?.role);
        
        return Response.json({ 
            success: true,
            message: 'Role updated to admin',
            user_id: me.id,
            email: me.email,
            old_role: me.role,
            new_role: updated[0]?.role
        });

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('❌ Stack:', error.stack);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});