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

        const { task_id, status, closed } = await req.json();

        if (!task_id) {
            return Response.json({ error: 'task_id is required' }, { status: 400 });
        }

        // If closing the task
        if (closed !== undefined) {
            const closeResponse = await fetch(
                `https://api.clickup.com/api/v2/task/${task_id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': user.clickup_access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: closed ? 'closed' : 'open'
                    })
                }
            );

            if (!closeResponse.ok) {
                const errorText = await closeResponse.text();
                console.error('ClickUp close task error:', errorText);
                return Response.json({ error: 'Failed to update task' }, { status: 500 });
            }

            return Response.json({ 
                success: true,
                message: closed ? 'Task closed' : 'Task reopened'
            });
        }

        // If changing status
        if (status) {
            const statusResponse = await fetch(
                `https://api.clickup.com/api/v2/task/${task_id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': user.clickup_access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: status
                    })
                }
            );

            if (!statusResponse.ok) {
                const errorText = await statusResponse.text();
                console.error('ClickUp update status error:', errorText);
                return Response.json({ error: 'Failed to update status' }, { status: 500 });
            }

            return Response.json({ 
                success: true,
                message: 'Status updated'
            });
        }

        return Response.json({ error: 'No update provided' }, { status: 400 });

    } catch (error) {
        console.error('Update ClickUp task error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});