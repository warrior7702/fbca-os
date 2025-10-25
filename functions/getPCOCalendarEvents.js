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
            return Response.json({ events: [], message: 'No PCO token found' });
        }

        // Get date range - 2 weeks from today
        const today = new Date();
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(today.getDate() + 14);

        const startDate = today.toISOString().split('T')[0];
        const endDate = twoWeeksFromNow.toISOString().split('T')[0];

        console.log('Fetching events from', startDate, 'to', endDate);

        // Fetch events from PCO Calendar
        const eventsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/events?filter=future&per_page=100`,
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text();
            console.error('PCO events fetch failed:', errorText);
            return Response.json({ error: 'Failed to fetch events', events: [] }, { status: 500 });
        }

        const eventsData = await eventsResponse.json();
        console.log('Found', eventsData.data?.length, 'total events');

        // Filter and format events
        const events = (eventsData.data || [])
            .filter(event => {
                const eventDate = new Date(event.attributes.starts_at);
                return eventDate >= today && eventDate <= twoWeeksFromNow;
            })
            .map(event => ({
                id: event.id,
                name: event.attributes.name,
                starts_at: event.attributes.starts_at,
                ends_at: event.attributes.ends_at,
                summary: event.attributes.summary,
                description: event.attributes.description,
                visible_in_church_center: event.attributes.visible_in_church_center,
                approval_status: event.attributes.approval_status
            }));

        console.log('Filtered to', events.length, 'events in date range');

        return Response.json({ 
            events: events,
            count: events.length
        });

    } catch (error) {
        console.error('Get PCO calendar events error:', error);
        return Response.json({ error: error.message, events: [] }, { status: 500 });
    }
});