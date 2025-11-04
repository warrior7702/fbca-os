import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    console.log('Refreshing PCO token...');

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.pco_refresh_token,
            client_id: Deno.env.get('PCO_CLIENT_ID'),
            client_secret: Deno.env.get('PCO_CLIENT_SECRET')
        })
    });

    if (!tokenResponse.ok) {
        throw new Error('PCO token refresh failed');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
    });

    return tokens.access_token;
}

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
            return Response.json({ 
                events: [], 
                message: 'PCO not connected. Please connect in Settings > Integrations' 
            });
        }

        // Refresh token if needed
        const accessToken = await refreshTokenIfNeeded(base44, user);

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
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text();
            console.error('PCO events fetch failed:', errorText);
            throw new Error('Failed to fetch calendar events');
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
        return Response.json({ 
            error: error.message, 
            events: [],
            details: 'Check function logs for more information'
        }, { status: 500 });
    }
});