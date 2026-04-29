import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'PCO not connected' }, { status: 400 });
        }

        const accessToken = user.pco_access_token;

        // Test the Building Access group (139176) endpoint
        const response = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/139176/event_resource_requests?where[approval_status]=P&per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({
                error: 'API call failed',
                status: response.status,
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();

        return Response.json({
            success: true,
            group_id: '139176',
            group_name: 'Building Access',
            total_requests: data.data?.length || 0,
            requests: data.data || [],
            full_response: data
        });

    } catch (error) {
        console.error('Test error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});