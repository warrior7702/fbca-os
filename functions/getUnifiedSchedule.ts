import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshPCOToken(base44, user) {
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

    if (!tokenResponse.ok) throw new Error('PCO token refresh failed');

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
    });

    return tokens.access_token;
}

async function refreshMicrosoftToken(base44, user) {
    const expiresAt = new Date(user.microsoft_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.microsoft_access_token;
    }

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.microsoft_refresh_token,
            client_id: Deno.env.get('MS_CLIENT_ID'),
            client_secret: Deno.env.get('MS_CLIENT_SECRET'),
            scope: 'openid profile email User.Read Calendars.ReadWrite Mail.Read Mail.Send Files.ReadWrite.All offline_access'
        })
    });

    if (!tokenResponse.ok) throw new Error('Microsoft token refresh failed');

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        microsoft_access_token: tokens.access_token,
        microsoft_refresh_token: tokens.refresh_token,
        microsoft_token_expires_at: newExpiresAt
    });

    return tokens.access_token;
}

function extractMeetingLink(event) {
    if (event.isOnlineMeeting && event.onlineMeeting?.joinUrl) {
        return {
            type: 'teams',
            url: event.onlineMeeting.joinUrl,
            provider: 'Microsoft Teams'
        };
    }

    const bodyText = event.body?.content || '';
    const zoomMatch = bodyText.match(/https:\/\/[^\s]*zoom\.us\/[^\s]*/i);
    if (zoomMatch) {
        return {
            type: 'zoom',
            url: zoomMatch[0],
            provider: 'Zoom'
        };
    }

    return null;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('📅 GET UNIFIED SCHEDULE (PCO + Microsoft)');
    console.log('========================================');

    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized', events: [] }, { status: 401 });
        }

        console.log('✅ User:', currentUser.email);

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user) {
            return Response.json({ events: [], message: 'User not found' });
        }

        const allEvents = [];
        const now = new Date();
        const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

        // PART 1: Fetch PCO Events (My Schedule resources)
        if (user.pco_access_token) {
            console.log('📝 Fetching PCO events...');
            try {
                const pcoToken = await refreshPCOToken(base44, user);
                const headers = { 'Authorization': `Bearer ${pcoToken}` };

                // Get my PCO person ID
                const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', { headers });
                if (!meResponse.ok) throw new Error('Failed to get PCO person ID');

                const meData = await meResponse.json();
                const myPersonId = meData.data?.id;

                // Get my approval groups
                const groupsResponse = await fetch(
                    'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
                    { headers }
                );

                if (!groupsResponse.ok) throw new Error('Failed to get approval groups');

                const groupsData = await groupsResponse.json();
                const allGroups = groupsData.data || [];

                const myGroupIds = new Set();
                const resourceToGroupMap = {};

                for (const group of allGroups.slice(0, 10)) {
                    await delay(50);
                    
                    const membersResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                        { headers }
                    );

                    if (membersResponse.ok) {
                        const membersData = await membersResponse.json();
                        const isMember = membersData.data?.some(m => m.id === myPersonId);
                        if (isMember) myGroupIds.add(group.id);
                    }

                    await delay(50);
                    
                    const resourcesResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                        { headers }
                    );

                    if (resourcesResponse.ok) {
                        const resourcesData = await resourcesResponse.json();
                        for (const resource of (resourcesData.data || [])) {
                            resourceToGroupMap[resource.id] = {
                                groupId: group.id,
                                groupName: group.attributes?.name
                            };
                        }
                    }
                }

                const myResourceIds = new Set(
                    Object.keys(resourceToGroupMap).filter(id => myGroupIds.has(resourceToGroupMap[id].groupId))
                );

                if (myResourceIds.size > 0) {
                    // Get future event instances
                    const instancesResponse = await fetch(
                        'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
                        { headers }
                    );

                    if (instancesResponse.ok) {
                        const instancesData = await instancesResponse.json();
                        const instances = instancesData.data || [];

                        const eventIds = new Set();
                        const eventInstanceMap = {};

                        for (const instance of instances) {
                            const eventId = instance.relationships?.event?.data?.id;
                            const startsAt = instance.attributes?.starts_at;
                            
                            if (eventId && startsAt) {
                                const startDate = new Date(startsAt);
                                if (startDate <= twoWeeksFromNow) {
                                    eventIds.add(eventId);
                                    if (!eventInstanceMap[eventId]) {
                                        eventInstanceMap[eventId] = {
                                            starts_at: startsAt,
                                            ends_at: instance.attributes?.ends_at
                                        };
                                    }
                                }
                            }
                        }

                        // Fetch events in batches
                        const eventIdArray = Array.from(eventIds);
                        for (let i = 0; i < eventIdArray.length && i < 20; i += 5) {
                            const batch = eventIdArray.slice(i, i + 5);
                            
                            await Promise.all(
                                batch.map(async (eventId) => {
                                    try {
                                        const [eventRes, requestsRes] = await Promise.all([
                                            fetch(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}`, { headers }),
                                            fetch(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`, { headers })
                                        ]);

                                        if (eventRes.ok && requestsRes.ok) {
                                            const eventData = await eventRes.json();
                                            const requestsData = await requestsRes.json();
                                            const event = eventData.data;

                                            const myResources = [];
                                            for (const request of (requestsData.data || [])) {
                                                const resourceId = request.relationships?.resource?.data?.id;
                                                if (myResourceIds.has(resourceId)) {
                                                    const resource = requestsData.included?.find(i => i.type === 'Resource' && i.id === resourceId);
                                                    myResources.push({
                                                        id: resourceId,
                                                        name: resource?.attributes?.name || 'Unknown',
                                                        approval_status: request.attributes?.approval_status
                                                    });
                                                }
                                            }

                                            if (myResources.length > 0) {
                                                const instance = eventInstanceMap[eventId];
                                                allEvents.push({
                                                    id: `pco_${eventId}`,
                                                    type: 'pco_event',
                                                    event_id: eventId,
                                                    name: event.attributes?.name || 'Untitled Event',
                                                    starts_at: instance.starts_at,
                                                    ends_at: instance.ends_at,
                                                    summary: event.attributes?.summary,
                                                    resources: myResources,
                                                    location: null,
                                                    meetingLink: null
                                                });
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error fetching event:', error);
                                    }
                                })
                            );
                            
                            await delay(200);
                        }
                    }
                }

                console.log(`✅ Fetched ${allEvents.length} PCO events`);
            } catch (error) {
                console.error('❌ PCO fetch error:', error.message);
            }
        } else {
            console.log('⚠️ PCO not connected');
        }

        // PART 2: Fetch Microsoft Calendar Events
        if (user.microsoft_access_token) {
            console.log('📅 Fetching Microsoft calendar events...');
            try {
                const msToken = await refreshMicrosoftToken(base44, user);
                
                const timezone = 'America/Chicago';
                const startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                const endDate = new Date(now);
                endDate.setDate(endDate.getDate() + 14);

                const calendarResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$orderby=start/dateTime&$top=100`,
                    {
                        headers: {
                            'Authorization': `Bearer ${msToken}`,
                            'Prefer': `outlook.timezone="${timezone}"`
                        }
                    }
                );

                if (calendarResponse.ok) {
                    const calendarData = await calendarResponse.json();
                    const msEvents = calendarData.value || [];

                    for (const event of msEvents) {
                        if (event.isCancelled) continue;

                        const meetingLink = extractMeetingLink(event);

                        allEvents.push({
                            id: `ms_${event.id}`,
                            type: 'meeting',
                            event_id: event.id,
                            name: event.subject || 'Untitled Meeting',
                            starts_at: event.start?.dateTime,
                            ends_at: event.end?.dateTime,
                            summary: event.bodyPreview || null,
                            resources: [],
                            location: event.location?.displayName || null,
                            meetingLink: meetingLink,
                            attendees: (event.attendees || []).map(a => ({
                                name: a.emailAddress?.name,
                                email: a.emailAddress?.address
                            })),
                            organizer: {
                                name: event.organizer?.emailAddress?.name,
                                email: event.organizer?.emailAddress?.address
                            },
                            responseStatus: event.responseStatus?.response,
                            webLink: event.webLink
                        });
                    }

                    console.log(`✅ Fetched ${msEvents.length} Microsoft meetings`);
                } else {
                    console.error('❌ Microsoft calendar fetch failed:', calendarResponse.status);
                }
            } catch (error) {
                console.error('❌ Microsoft fetch error:', error.message);
            }
        } else {
            console.log('⚠️ Microsoft not connected');
        }

        // Sort all events by start time
        allEvents.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

        console.log(`✅ Total unified events: ${allEvents.length}`);
        console.log('========================================');

        return Response.json({
            success: true,
            events: allEvents,
            count: allEvents.length,
            sources: {
                pco: allEvents.filter(e => e.type === 'pco_event').length,
                microsoft: allEvents.filter(e => e.type === 'meeting').length
            }
        });

    } catch (error) {
        console.error('========================================');
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        console.error('========================================');
        return Response.json({ 
            error: error.message,
            events: []
        }, { status: 500 });
    }
});