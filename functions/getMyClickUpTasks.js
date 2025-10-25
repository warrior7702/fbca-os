import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.clickup_access_token) {
            return Response.json({ error: 'ClickUp not connected' }, { status: 400 });
        }

        // Get user's teams
        const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
            headers: {
                'Authorization': user.clickup_access_token
            }
        });

        if (!teamsResponse.ok) {
            return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
        }

        const teamsData = await teamsResponse.json();
        
        // Get ClickUp user ID
        const meResponse = await fetch('https://api.clickup.com/api/v2/user', {
            headers: {
                'Authorization': user.clickup_access_token
            }
        });

        if (!meResponse.ok) {
            return Response.json({ error: 'Failed to get user info' }, { status: 500 });
        }

        const meData = await meResponse.json();
        const clickupUserId = meData.user.id;

        // Fetch tasks from all teams
        let allTasks = [];

        for (const team of teamsData.teams) {
            try {
                // Get tasks assigned to me
                const tasksResponse = await fetch(
                    `https://api.clickup.com/api/v2/team/${team.id}/task?assignees[]=${clickupUserId}&include_closed=false`,
                    {
                        headers: {
                            'Authorization': user.clickup_access_token
                        }
                    }
                );

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    allTasks = allTasks.concat(tasksData.tasks || []);
                }
            } catch (error) {
                console.error(`Error fetching tasks for team ${team.id}:`, error);
            }
        }

        // Format tasks
        const formattedTasks = allTasks.map(task => ({
            id: task.id,
            title: task.name,
            status: task.status?.status || 'No Status',
            priority: task.priority?.priority || 'none',
            due_date: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
            url: task.url,
            list_name: task.list?.name,
            folder_name: task.folder?.name,
            space_name: task.space?.name,
            description: task.description
        }));

        return Response.json({ 
            tasks: formattedTasks,
            count: formattedTasks.length
        });

    } catch (error) {
        console.error('Get ClickUp tasks error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});