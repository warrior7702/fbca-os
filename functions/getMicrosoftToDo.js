import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.microsoft_access_token) {
            return Response.json({ error: 'Microsoft 365 not connected' }, { status: 400 });
        }

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Get all task lists
        const listsResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/todo/lists',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!listsResponse.ok) {
            const errorText = await listsResponse.text();
            console.error('Failed to fetch To Do lists:', errorText);
            return Response.json({ error: 'Failed to fetch To Do lists' }, { status: 500 });
        }

        const listsData = await listsResponse.json();
        const allTasks = [];

        // Fetch tasks from each list
        for (const list of listsData.value) {
            const tasksResponse = await fetch(
                `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();
                const formattedTasks = tasksData.value.map(task => ({
                    id: task.id,
                    title: task.title,
                    body: task.body?.content,
                    status: task.status,
                    importance: task.importance,
                    due_date: task.dueDateTime?.dateTime,
                    created_date: task.createdDateTime,
                    list_name: list.displayName,
                    list_id: list.id,
                    url: task.webUrl,
                    source: 'microsoft_todo'
                }));
                allTasks.push(...formattedTasks);
            }
        }

        return Response.json({ 
            tasks: allTasks,
            count: allTasks.length
        });

    } catch (error) {
        console.error('Get Microsoft To Do tasks error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});