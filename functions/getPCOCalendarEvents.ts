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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        
        if (response.status === 429 && attempt < maxRetries) {
            await delay(1000 * attempt);
            continue;
        }
        
        return response;
    }
    throw new Error('Rate limit exceeded');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized', events: [] }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                events: [], 
                message: 'PCO not connected. Please connect in Settings > Integrations' 
            });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // Fetch event instances (first 3 pages only for speed)
        const instances = [];
        let nextUrl = 'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&order=starts_at&per_page=100';
        let pageCount = 0;
        
        while (nextUrl && pageCount < 3) {
            const response = await fetchWithRetry(nextUrl, { headers });
            if (!response.ok) break;
            
            const data = await response.json();
            instances.push(...(data.data || []));
            nextUrl = data.links?.next;
            pageCount++;
        }
        
        if (instances.length === 0) {
            return Response.json({ events: [], message: 'No upcoming events found' });
        }

        // Filter to next 60 days
        const now = new Date();
        const sixtyDaysFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));

        const eventIds = new Set();
        instances.forEach(instance => {
            const eventId = instance.relationships?.event?.data?.id;
            if (eventId) eventIds.add(eventId);
        });

        // Fetch event data in OPTIMIZED batches
        const eventDataMap = {};
        const eventIdArray = Array.from(eventIds);
        const batchSize = 8; // INCREASED for speed
        
        for (let i = 0; i < eventIdArray.length; i += batchSize) {
            const batch = eventIdArray.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(async (eventId) => {
                    try {
                        // Fetch event and requests in parallel
                        const [eventRes, requestsRes] = await Promise.all([
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}?include=tags`, { headers }),
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource,resource_approval_groups&per_page=100`, { headers })
                        ]);

                        if (!eventRes.ok) {
                            return { eventId, data: { name: 'Loading...', resource_requests: [], tags: [] } };
                        }

                        const eventData = await eventRes.json();
                        const event = eventData.data;
                        
                        const eventName = event.attributes?.name || event.attributes?.summary || 'Unnamed Event';
                        
                        const tags = [];
                        if (eventData.included) {
                            for (const item of eventData.included) {
                                if (item.type === 'Tag') tags.push(item.attributes?.name);
                            }
                        }
                        
                        const resourceRequests = [];
                        
                        if (requestsRes.ok) {
                            const requestsData = await requestsRes.json();
                            
                            const resourceMap = {};
                            const approvalGroupMap = {};
                            
                            if (requestsData.included) {
                                for (const item of requestsData.included) {
                                    if (item.type === 'Resource') {
                                        resourceMap[item.id] = {
                                            id: item.id,
                                            name: item.attributes?.name || 'Unknown',
                                            kind: item.attributes?.kind || 'Unknown'
                                        };
                                    } else if (item.type === 'ResourceApprovalGroup') {
                                        approvalGroupMap[item.id] = {
                                            id: item.id,
                                            name: item.attributes?.name || 'Unknown'
                                        };
                                    }
                                }
                            }
                            
                            for (const request of (requestsData.data || [])) {
                                const resourceId = request.relationships?.resource?.data?.id;
                                const approvalGroupId = request.relationships?.resource_approval_groups?.data?.[0]?.id;
                                const resource = resourceMap[resourceId];
                                const approvalGroup = approvalGroupMap[approvalGroupId];
                                
                                if (resource) {
                                    resourceRequests.push({
                                        id: request.id,
                                        resource_id: resourceId,
                                        resource_name: resource.name,
                                        resource_kind: resource.kind,
                                        resource_category: approvalGroup?.name || 'Uncategorized',
                                        approval_status: request.attributes?.approval_status,
                                        quantity: request.attributes?.quantity,
                                        answers: [] // Skip fetching answers for speed
                                    });
                                }
                            }
                        }
                        
                        return {
                            eventId,
                            data: {
                                name: eventName,
                                summary: event.attributes?.summary || null,
                                description: event.attributes?.description || null,
                                visible_in_church_center: event.attributes?.visible_in_church_center,
                                approval_status: event.attributes?.approval_status,
                                resource_requests: resourceRequests,
                                tags: tags
                            }
                        };
                    } catch (error) {
                        return { eventId, data: { name: 'Error', resource_requests: [], tags: [] } };
                    }
                })
            );
            
            batchResults.forEach(result => {
                if (result) eventDataMap[result.eventId] = result.data;
            });
            
            // Shorter delay between batches
            if (i + batchSize < eventIdArray.length) {
                await delay(200);
            }
        }

        // Process instances
        const eventsWithResources = [];
        
        for (const instance of instances) {
            const eventId = instance.relationships?.event?.data?.id;
            const eventData = eventDataMap[eventId];
            
            const starts_at = instance.attributes?.starts_at;
            const ends_at = instance.attributes?.ends_at;
            
            if (!starts_at || !ends_at) continue;

            const startDate = new Date(starts_at);
            if (startDate > sixtyDaysFromNow) continue;
            
            const resourcesMap = new Map();
            if (eventData?.resource_requests) {
                for (const request of eventData.resource_requests) {
                    resourcesMap.set(request.resource_id, {
                        id: request.resource_id,
                        name: request.resource_name,
                        kind: request.resource_kind,
                        category: request.resource_category,
                        approval_status: request.approval_status,
                        answers: []
                    });
                }
            }
            
            const resources = Array.from(resourcesMap.values());
            
            eventsWithResources.push({
                id: instance.id,
                event_id: eventId,
                name: eventData?.name || 'Unnamed Event',
                starts_at: starts_at,
                ends_at: ends_at,
                summary: eventData?.summary,
                description: eventData?.description,
                visible_in_church_center: eventData?.visible_in_church_center,
                approval_status: eventData?.approval_status,
                resources: resources,
                tags: eventData?.tags || [],
                resource_count: resources.length,
                has_valid_dates: true
            });
        }

        return Response.json({ 
            events: eventsWithResources,
            count: eventsWithResources.length,
            date_range: {
                start: now.toISOString(),
                end: sixtyDaysFromNow.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            error: error.message, 
            events: []
        }, { status: 500 });
    }
});