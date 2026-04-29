import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📥 Getting approvals for:', currentUser.email);

        // Get from database
        const approvals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(err => {
            console.error('❌ Database error:', err);
            return [];
        });

        console.log('✅ Found', approvals?.length || 0, 'approvals in database');

        return Response.json({ 
            pending_approvals: approvals || [],
            count: approvals?.length || 0
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            error: error.message, 
            pending_approvals: [],
            count: 0
        }, { status: 500 });
    }
});