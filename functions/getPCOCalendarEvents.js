import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    console.log('🔄 Refreshing PCO token...');

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
            console.error('❌ No current user');
            return Response.json({ error: 'Unauthorized', events: [] }, { status: 401 });
        }

        console.log('✅ Current user:', currentUser.email);

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            console.error('❌ No PCO token for user');
            return Response.json({ 
                events: [], 
                message: 'PCO not connected. Please connect in Settings > Integrations' 
            });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        console.log('✅ Access token ready');

        // ULTRA AGGRESSIVE: Only fetch next 21 days (3 weeks)
        const now = new Date();
        const threeWeeksFromNow = new Date(now.getTime() + (21 * 24 * 60 * 60 * 1000));
        
        const startDate = now.toISOString();
        const endDate = threeWeeksFromNow.toISOString();

        console.log('📅 Fetching events from', startDate, 'to', endDate);

        // Fetch event instances with resources included in ONE CALL
        const baseUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&filter[starts_at][gte]=${startDate}&filter[starts_at][lte]=${endDate}&include=event,event_resource_requests.resource&order=starts_at&per_page=100`;
        
        console.log('🔗 Fetching instances with includes...');
        
        // Only fetch 2 pages max (200 events)
        let allInstances = [];
        let allIncluded = [];
        let nextUrl = baseUrl;
        let pageCount = 0;
        const maxPages = 2;
        
        while (nextUrl && pageCount < maxPages) {
            pageCount++;
            console.log(`📄 Fetching page ${pageCount}/${maxPages}...`);
            
            const response = await fetch(nextUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ PCO fetch failed:', response.status, errorText);
                throw new Error(`Failed to fetch calendar events: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                allInstances = allInstances.concat(data.data);
                if (data.included) {
                    allIncluded = allIncluded.concat(data.included);
                }
                console.log(`  ✅ Got ${data.data.length} instances (total: ${allInstances.length})`);
            }
            
            nextUrl = data.links?.next;
        }
        
        console.log('📦 Total instances:', allInstances.length);
        console.log('📦 Total included:', allIncluded.length);
        
        if (allInstances.length === 0) {
            return Response.json({ 
                events: [],
                message: 'No upcoming event instances found for next 3 weeks'
            });
        }

        // Build lookup maps from included data
        const eventsMap = {};
        const resourcesMap = {};
        const resourceRequestsMap = {};

        for (const item of allIncluded) {
            if (item.type === 'Event') {
                eventsMap[item.id] = item;
            } else if (item.type === 'Resource') {
                resourcesMap[item.id] = item;
            } else if (item.type === 'EventResourceRequest') {
                resourceRequestsMap[item.id] = item;
            }
        }

        console.log('📊 Parsed included data:', {
            events: Object.keys(eventsMap).length,
            resources: Object.keys(resourcesMap).length,
            requests: Object.keys(resourceRequestsMap).length
        });

        // Build final events array
        const eventsWithResources = [];
        
        for (const instance of allInstances) {
            const eventId = instance.relationships?.event?.data?.id;
            const event = eventsMap[eventId];
            
            if (!event) {
                console.warn('⚠️ No event data for instance:', instance.id);
                continue;
            }
            
            const starts_at = instance.attributes?.starts_at;
            const ends_at = instance.attributes?.ends_at;
            
            if (!starts_at || !ends_at) {
                console.warn('⚠️ Skipping instance without dates:', instance.id);
                continue;
            }
            
            // Build resources array from relationships
            const resources = [];
            const requestRelationships = instance.relationships?.event_resource_requests?.data || [];
            
            for (const requestRef of requestRelationships) {
                const request = resourceRequestsMap[requestRef.id];
                if (!request) continue;
                
                const resourceId = request.relationships?.resource?.data?.id;
                const resource = resourcesMap[resourceId];
                
                if (resource) {
                    resources.push({
                        id: resourceId,
                        name: resource.attributes?.name,
                        kind: resource.attributes?.kind,
                        approval_status: request.attributes?.approval_status
                    });
                }
            }
            
            eventsWithResources.push({
                id: instance.id,
                event_id: eventId,
                name: event.attributes?.name || 'Untitled Event',
                starts_at: starts_at,
                ends_at: ends_at,
                summary: event.attributes?.summary,
                description: event.attributes?.description,
                resources: resources,
                tags: [], // Skip tags for speed
                resource_count: resources.length
            });
        }

        console.log('🎯 Final result:', eventsWithResources.length, 'events');

        return Response.json({ 
            events: eventsWithResources,
            count: eventsWithResources.length,
            date_range: {
                start: startDate,
                end: endDate
            }
        });

    } catch (error) {
        console.error('❌ Get PCO calendar events error:', error);
        console.error('❌ Error stack:', error.stack);
        return Response.json({ 
            error: error.message, 
            events: [],
            details: error.stack
        }, { status: 500 });
    }
});