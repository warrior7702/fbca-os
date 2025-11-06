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

        const { list_id } = await req.json();

        if (!list_id) {
            return Response.json({ error: 'list_id is required' }, { status: 400 });
        }

        // Get list details which includes statuses
        const response = await fetch(
            `https://api.clickup.com/api/v2/list/${list_id}`,
            {
                headers: {
                    'Authorization': user.clickup_access_token
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ClickUp get list error:', errorText);
            return Response.json({ error: 'Failed to get list statuses' }, { status: 500 });
        }

        const listData = await response.json();
        
        // Extract statuses
        const statuses = listData.statuses?.map(status => ({
            name: status.status,
            type: status.type, // e.g., "open", "custom", "closed"
            color: status.color,
            orderindex: status.orderindex
        })) || [];

        return Response.json({ 
            statuses,
            list_name: listData.name
        });

    } catch (error) {
        console.error('Get list statuses error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});