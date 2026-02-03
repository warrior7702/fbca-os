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

        const { list_id, task_id } = await req.json();

        if (!list_id || !task_id) {
            return Response.json({ error: 'list_id and task_id are required' }, { status: 400 });
        }

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Mark task as completed
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/todo/lists/${list_id}/tasks/${task_id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'completed'
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to complete task:', errorText);
            return Response.json({ error: 'Failed to complete task' }, { status: 500 });
        }

        return Response.json({ 
            success: true,
            message: 'Task completed successfully'
        });

    } catch (error) {
        console.error('Complete Microsoft To Do task error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});