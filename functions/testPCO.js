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

        // Test API call - get user's organizations
        const response = await fetch('https://api.planningcenteronline.com/people/v2/me', {
            headers: {
                'Authorization': `Bearer ${user.pco_access_token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PCO API error:', errorText);
            return Response.json({ error: 'Failed to fetch Planning Center data' }, { status: 500 });
        }

        const userData = await response.json();

        // Get calendar events
        const eventsResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/events?filter=future&per_page=5', {
            headers: {
                'Authorization': `Bearer ${user.pco_access_token}`
            }
        });

        let events = [];
        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            events = eventsData.data.map(event => ({
                name: event.attributes.name,
                starts_at: event.attributes.starts_at
            }));
        }

        return Response.json({
            success: true,
            user_id: userData.data.id,
            user_data: userData.data.attributes,
            events: events
        });

    } catch (error) {
        console.error('Test PCO error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});