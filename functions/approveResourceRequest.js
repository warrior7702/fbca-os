import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.pco_access_token) {
            return Response.json({ error: 'Planning Center not connected' }, { status: 400 });
        }

        const { request_id } = await req.json();

        if (!request_id) {
            return Response.json({ error: 'Missing request_id' }, { status: 400 });
        }

        // Approve the resource request
        const response = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        type: 'EventResourceRequest',
                        id: request_id,
                        attributes: {
                            approval_status: 'A' // A = Approved
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PCO approval failed:', errorText);
            return Response.json({ error: 'Failed to approve request' }, { status: 500 });
        }

        const data = await response.json();

        return Response.json({ 
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Approve request error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});