import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.pco_refresh_token,
            client_id: Deno.env.get('PCO_CLIENT_ID'),
            client_secret: Deno.env.get('PCO_CLIENT_SECRET')
        })
    });

    if (!tokenResponse.ok) throw new Error('Token refresh failed');

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
            return Response.json({ error: 'PCO not connected' }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Test 1: Calendar Event Resource Requests (what we currently use)
        const calendarRequests = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=25',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let calendarData = null;
        if (calendarRequests.ok) {
            calendarData = await calendarRequests.json();
        }

        // Test 2: Resources API Approval Requests (what you're describing)
        const resourcesRequests = await fetch(
            'https://api.planningcenteronline.com/resources/v2/approval_requests?where[approval_status]=P&per_page=25',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let resourcesData = null;
        let resourcesError = null;
        if (resourcesRequests.ok) {
            resourcesData = await resourcesRequests.json();
        } else {
            resourcesError = {
                status: resourcesRequests.status,
                message: await resourcesRequests.text()
            };
        }

        // Test 3: Get my PCO person ID
        const meResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/me',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let myPersonId = null;
        if (meResponse.ok) {
            const meData = await meResponse.json();
            myPersonId = meData.data?.id;
        }

        return Response.json({
            my_pco_person_id: myPersonId,
            calendar_api: {
                endpoint: '/calendar/v2/event_resource_requests',
                count: calendarData?.data?.length || 0,
                sample: calendarData?.data?.slice(0, 3).map(r => ({
                    id: r.id,
                    approval_status: r.attributes?.approval_status,
                    resource: r.relationships?.resource?.data?.id,
                    event: r.relationships?.event?.data?.id
                }))
            },
            resources_api: {
                endpoint: '/resources/v2/approval_requests',
                count: resourcesData?.data?.length || 0,
                error: resourcesError,
                sample: resourcesData?.data?.slice(0, 3).map(r => ({
                    id: r.id,
                    approval_status: r.attributes?.approval_status,
                    details: r.attributes
                }))
            }
        });

    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});