import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.microsoft_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.microsoft_access_token;
    }

    console.log('🔄 Refreshing Microsoft token...');

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.microsoft_refresh_token,
            client_id: Deno.env.get('MS_CLIENT_ID') || Deno.env.get('MICROSOFT_CLIENT_ID'),
            client_secret: Deno.env.get('MS_CLIENT_SECRET') || Deno.env.get('MICROSOFT_CLIENT_SECRET'),
            scope: 'openid profile email User.Read Calendars.ReadWrite Mail.Read Mail.Send Files.ReadWrite.All offline_access'
        })
    });

    if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('❌ Token refresh failed:', error);
        throw new Error('Microsoft token refresh failed');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        microsoft_access_token: tokens.access_token,
        microsoft_refresh_token: tokens.refresh_token,
        microsoft_token_expires_at: newExpiresAt
    });

    console.log('✅ Token refreshed');
    return tokens.access_token;
}

function extractMeetingLink(event) {
    // Check for Teams meeting
    if (event.isOnlineMeeting && event.onlineMeeting?.joinUrl) {
        return {
            type: 'teams',
            url: event.onlineMeeting.joinUrl,
            provider: 'Microsoft Teams'
        };
    }

    // Check body for Zoom links
    const bodyText = event.body?.content || '';
    const zoomMatch = bodyText.match(/https:\/\/[^\s]*zoom\.us\/[^\s]*/i);
    if (zoomMatch) {
        return {
            type: 'zoom',
            url: zoomMatch[0],
            provider: 'Zoom'
        };
    }

    // Check body for Teams links
    const teamsMatch = bodyText.match(/https:\/\/teams\.microsoft\.com\/[^\s]*/i);
    if (teamsMatch) {
        return {
            type: 'teams',
            url: teamsMatch[0],
            provider: 'Microsoft Teams'
        };
    }

    // Check location for meeting links
    const location = event.location?.displayName || '';
    const locationZoom = location.match(/https:\/\/[^\s]*zoom\.us\/[^\s]*/i);
    if (locationZoom) {
        return {
            type: 'zoom',
            url: locationZoom[0],
            provider: 'Zoom'
        };
    }

    return null;
}

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('📅 GET MICROSOFT CALENDAR');
    console.log('========================================');

    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            console.log('❌ No authenticated user');
            return Response.json({ error: 'Unauthorized', events: [] }, { status: 401 });
        }

        console.log('✅ User:', currentUser.email);

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.microsoft_access_token) {
            console.log('❌ No Microsoft token');
            return Response.json({ 
                events: [], 
                message: 'Microsoft not connected. Please connect in Settings > Integrations' 
            });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        console.log('✅ Got access token');

        // Get date range - 7 days ago to 60 days ahead
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 60);

        const startDateTime = startDate.toISOString();
        const endDateTime = endDate.toISOString();

        console.log('📅 Fetching events from', startDateTime, 'to', endDateTime);

        // Fetch calendar events
        const calendarResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime&$top=100`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Prefer': 'outlook.timezone="UTC"'
                }
            }
        );

        if (!calendarResponse.ok) {
            const error = await calendarResponse.text();
            console.error('❌ Failed to fetch calendar:', calendarResponse.status, error);
            throw new Error('Failed to fetch calendar events');
        }

        const calendarData = await calendarResponse.json();
        const events = calendarData.value || [];

        console.log(`✅ Fetched ${events.length} calendar events`);

        // Process events
        const processedEvents = events.map(event => {
            const meetingLink = extractMeetingLink(event);
            
            return {
                id: event.id,
                subject: event.subject || 'Untitled Meeting',
                start: event.start?.dateTime,
                end: event.end?.dateTime,
                location: event.location?.displayName || null,
                isOnlineMeeting: event.isOnlineMeeting || false,
                meetingLink: meetingLink,
                attendees: (event.attendees || []).map(a => ({
                    name: a.emailAddress?.name,
                    email: a.emailAddress?.address,
                    status: a.status?.response // accepted, declined, tentative, etc.
                })),
                organizer: {
                    name: event.organizer?.emailAddress?.name,
                    email: event.organizer?.emailAddress?.address
                },
                bodyPreview: event.bodyPreview || null,
                body: event.body?.content || null,
                isAllDay: event.isAllDay || false,
                isCancelled: event.isCancelled || false,
                responseStatus: event.responseStatus?.response, // organizer, accepted, declined, etc.
                sensitivity: event.sensitivity, // normal, personal, private, confidential
                showAs: event.showAs, // free, tentative, busy, oof, workingElsewhere, unknown
                webLink: event.webLink,
                categories: event.categories || [],
                hasAttachments: event.hasAttachments || false
            };
        });

        // Filter out cancelled events
        const activeEvents = processedEvents.filter(e => !e.isCancelled);

        console.log(`✅ Returning ${activeEvents.length} active events`);
        console.log('========================================');

        return Response.json({
            success: true,
            events: activeEvents,
            count: activeEvents.length
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