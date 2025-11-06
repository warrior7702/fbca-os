import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || !user.microsoft_access_token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's groups from Microsoft Graph
        const groupsResponse = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
            headers: {
                'Authorization': `Bearer ${user.microsoft_access_token}`
            }
        });

        if (!groupsResponse.ok) {
            return Response.json({ error: 'Failed to fetch groups' }, { status: 500 });
        }

        const groupsData = await groupsResponse.json();
        const groups = groupsData.value.map(g => ({
            id: g.id,
            name: g.displayName
        }));

        // Map groups to roles
        let newRole = 'user';
        const adminGroupIds = [
            'YOUR-ADMIN-GROUP-ID',
            'YOUR-IT-GROUP-ID'
        ];

        if (groups.some(g => adminGroupIds.includes(g.id))) {
            newRole = 'admin';
        }

        // Update user role if changed
        if (user.role !== newRole) {
            await base44.auth.updateMe({ role: newRole });
        }

        // Store groups for reference
        await base44.auth.updateMe({ 
            azure_groups: JSON.stringify(groups)
        });

        return Response.json({ 
            success: true,
            groups: groups,
            role: newRole
        });

    } catch (error) {
        console.error('Group sync error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});