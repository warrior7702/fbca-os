import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // Fetch tasks from all teams - EXPANDED to get MORE tasks
        let allTasks = [];

        for (const team of teamsData.teams) {
            try {
                // Get ALL tasks assigned to me (open and closed from last 30 days)
                const tasksResponse = await fetch(
                    `https://api.clickup.com/api/v2/team/${team.id}/task?assignees[]=${clickupUserId}&subtasks=true&include_closed=false&page=0`,
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

        console.log(`Fetched ${allTasks.length} total tasks for user ${user.email}`);

        // Format tasks with all details
        const formattedTasks = allTasks.map(task => ({
            id: task.id,
            title: task.name,
            status: task.status?.status || 'No Status',
            priority: task.priority?.priority || 'none',
            due_date: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
            url: task.url,
            list_name: task.list?.name,
            list_id: task.list?.id,
            folder_name: task.folder?.name,
            space_name: task.space?.name,
            description: task.description || task.text_content,
            tags: task.tags?.map(tag => tag.name) || [],
            time_estimate: task.time_estimate,
            assignees: task.assignees?.map(a => a.username) || [],
            custom_fields: task.custom_fields?.map(field => ({
                name: field.name,
                value: field.value,
                type: field.type
            })) || [],
            subtasks: task.subtasks?.length || 0,
            attachments: task.attachments?.length || 0,
            comments: task.comments?.length || 0
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