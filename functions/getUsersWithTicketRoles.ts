import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔍 Fetching ticket role assignments...');

        // Fetch all ticket role assignments from the entity
        const assignments = await base44.asServiceRole.entities.TicketRoleAssignment.list();

        console.log(`✅ Retrieved ${assignments.length} ticket role assignments`);

        // Categorize by role
        const workers = assignments.filter(a => a.ticket_role === 'worker');
        const viewers = assignments.filter(a => a.ticket_role === 'viewer');

        // Get department stats
        const departmentStats = {};
        const departmentList = new Set();

        assignments.forEach(assignment => {
            if (assignment.department) {
                departmentList.add(assignment.department);
                
                if (!departmentStats[assignment.department]) {
                    departmentStats[assignment.department] = {
                        workers: 0,
                        viewers: 0,
                        total: 0
                    };
                }
                
                departmentStats[assignment.department].total++;
                
                if (assignment.ticket_role === 'worker') {
                    departmentStats[assignment.department].workers++;
                } else if (assignment.ticket_role === 'viewer') {
                    departmentStats[assignment.department].viewers++;
                }
            }
        });

        const stats = {
            total: assignments.length,
            workers: workers.length,
            viewers: viewers.length,
            departments: Array.from(departmentList).sort()
        };

        console.log('📊 Stats:', JSON.stringify(stats, null, 2));
        console.log('📊 Departments found:', Array.from(departmentList).sort());

        return Response.json({
            success: true,
            stats: stats,
            workers: workers,
            viewers: viewers,
            departmentStats: departmentStats,
            departmentList: Array.from(departmentList).sort(),
            allUsers: assignments
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({
            success: false,
            error: 'Failed to fetch ticket role assignments',
            details: error.message,
            users: []
        }, { status: 500 });
    }
});