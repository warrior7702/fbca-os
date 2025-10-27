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

        const { task_id, due_date } = await req.json();

        if (!task_id || !due_date) {
            return Response.json({ error: 'task_id and due_date are required' }, { status: 400 });
        }

        // Convert date to timestamp (ClickUp expects milliseconds)
        const dueTimestamp = new Date(due_date).getTime();

        const response = await fetch(
            `https://api.clickup.com/api/v2/task/${task_id}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': user.clickup_access_token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    due_date: dueTimestamp,
                    due_date_time: true // Include time
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ClickUp update due date error:', errorText);
            return Response.json({ error: 'Failed to update due date' }, { status: 500 });
        }

        return Response.json({ 
            success: true,
            message: 'Due date updated'
        });

    } catch (error) {
        console.error('Update due date error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});