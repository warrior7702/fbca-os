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

async function fetchAllInstances(accessToken, baseUrl) {
    let allInstances = [];
    let nextUrl = baseUrl;
    let pageCount = 0;
    const maxPages = 10; // Increased to fetch up to 1000 instances (10 pages * 100)
    
    while (nextUrl && pageCount < maxPages) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount}...`);
        
        const response = await fetch(nextUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ PCO instances fetch failed:', response.status, errorText);
            throw new Error(`Failed to fetch calendar events: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            allInstances = allInstances.concat(data.data);
            console.log(`  ✅ Got ${data.data.length} instances (total: ${allInstances.length})`);
        }
        
        nextUrl = data.links?.next;
    }
    
    console.log(`📊 Total pages fetched: ${pageCount}`);
    console.log(`📊 Total instances: ${allInstances.length}`);
    
    return allInstances;
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

        // Fetch future event instances
        const baseUrl = 'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&order=starts_at&per_page=100';
        
        console.log('🔗 Base URL:', baseUrl);
        
        const instances = await fetchAllInstances(accessToken, baseUrl);
        
        console.log('📦 Total event instances fetched:', instances.length);
        
        if (instances.length === 0) {
            console.warn('⚠️ No event instances in response from PCO');
            return Response.json({ 
                events: [],
                message: 'No upcoming event instances found in PCO Calendar'
            });
        }

        // Filter to next 60 days on our side
        const now = new Date();
        const sixtyDaysFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));

        // Get unique event IDs
        const eventIds = new Set();
        instances.forEach(instance => {
            const eventId = instance.relationships?.event?.data?.id;
            if (eventId) eventIds.add(eventId);
        });

        console.log('📊 Unique events:', eventIds.size);

        // Fetch full event data with resources and tags for each unique event (in parallel batches)
        const eventDataMap = {};
        const eventIdArray = Array.from(eventIds);
        const batchSize = 15; // Increased batch size for faster processing
        
        let eventsWithoutNames = 0;
        let eventsWithoutResources = 0;
        
        for (let i = 0; i < eventIdArray.length; i += batchSize) {
            const batch = eventIdArray.slice(i, i + batchSize);
            console.log(`🔄 Processing event batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eventIdArray.length / batchSize)}`);
            
            const batchPromises = batch.map(async (eventId) => {
                try {
                    // Fetch event with tags
                    const eventResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/events/${eventId}?include=tags`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (!eventResponse.ok) {
                        console.error(`❌ Failed to fetch event ${eventId}: ${eventResponse.status}`);
                        return {
                            eventId,
                            data: {
                                name: `Event ${eventId}`,
                                summary: null,
                                description: null,
                                visible_in_church_center: false,
                                approval_status: null,
                                resource_requests: [],
                                tags: []
                            }
                        };
                    }

                    const eventData = await eventResponse.json();
                    const event = eventData.data;
                    
                    // Get event name - try multiple sources
                    let eventName = event.attributes?.name;
                    
                    // If name is missing or empty, try summary
                    if (!eventName || eventName.trim() === '') {
                        eventName = event.attributes?.summary;
                    }
                    
                    // If still missing, use ID-based name
                    if (!eventName || eventName.trim() === '') {
                        console.warn(`⚠️ Event ${eventId} has no name or summary! Using fallback.`);
                        eventName = `Unnamed Event (${eventId})`;
                        eventsWithoutNames++;
                    }
                    
                    // Extract tags from included
                    const tags = [];
                    if (eventData.included) {
                        for (const item of eventData.included) {
                            if (item.type === 'Tag') {
                                tags.push(item.attributes?.name);
                            }
                        }
                    }
                    
                    // Fetch event_resource_requests separately
                    const requestsResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    const resourceRequests = [];
                    
                    if (requestsResponse.ok) {
                        const requestsData = await requestsResponse.json();
                        
                        // Build a map of resources from included
                        const resourceMap = {};
                        if (requestsData.included) {
                            for (const item of requestsData.included) {
                                if (item.type === 'Resource') {
                                    resourceMap[item.id] = {
                                        id: item.id,
                                        name: item.attributes?.name || 'Unnamed Resource',
                                        kind: item.attributes?.kind || 'Unknown'
                                    };
                                }
                            }
                        }
                        
                        // Build resource requests with full resource info AND fetch answers
                        for (const request of (requestsData.data || [])) {
                            const resourceId = request.relationships?.resource?.data?.id;
                            const resource = resourceMap[resourceId];
                            
                            if (resource) {
                                // Fetch answers for this resource request
                                const answers = [];
                                try {
                                    const answersResponse = await fetch(
                                        `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request.id}/answers?per_page=100`,
                                        {
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Content-Type': 'application/json'
                                            }
                                        }
                                    );

                                    if (answersResponse.ok) {
                                        const answersData = await answersResponse.json();
                                        
                                        for (const answer of (answersData.data || [])) {
                                            const questionAttr = answer.attributes?.question;
                                            const questionText = typeof questionAttr === 'string' ? questionAttr : 
                                                               (questionAttr?.question || questionAttr?.text || '');
                                            
                                            let value = answer.attributes?.value || answer.attributes?.answer || answer.attributes?.text;
                                            
                                            // Handle object values
                                            if (typeof value === 'object' && value !== null) {
                                                value = JSON.stringify(value);
                                            }
                                            
                                            // Only add if both question and value exist
                                            if (questionText && value) {
                                                answers.push({
                                                    question: String(questionText),
                                                    answer: String(value)
                                                });
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.warn(`⚠️ Error fetching answers for request ${request.id}:`, error.message);
                                }
                                
                                resourceRequests.push({
                                    id: request.id,
                                    resource_id: resourceId,
                                    resource_name: resource.name,
                                    resource_kind: resource.kind,
                                    approval_status: request.attributes?.approval_status,
                                    quantity: request.attributes?.quantity,
                                    answers: answers
                                });
                            }
                        }
                        
                        if (resourceRequests.length === 0) {
                            eventsWithoutResources++;
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
                    console.error(`❌ Error fetching event ${eventId}:`, error);
                    return {
                        eventId,
                        data: {
                            name: `Event ${eventId} (Error)`,
                            summary: null,
                            description: null,
                            visible_in_church_center: false,
                            approval_status: null,
                            resource_requests: [],
                            tags: []
                        }
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result) {
                    eventDataMap[result.eventId] = result.data;
                }
            });
        }

        console.log('📊 Fetched full data for', Object.keys(eventDataMap).length, 'events');
        console.log('⚠️ Events without names:', eventsWithoutNames);
        console.log('⚠️ Events without resources:', eventsWithoutResources);

        // Process event instances
        const eventsWithResources = [];
        let skippedNoDates = 0;
        let skippedBeyond60Days = 0;
        
        for (const instance of instances) {
            const eventId = instance.relationships?.event?.data?.id;
            const eventData = eventDataMap[eventId];
            
            const starts_at = instance.attributes?.starts_at;
            const ends_at = instance.attributes?.ends_at;
            
            if (!starts_at || !ends_at) {
                console.warn('⚠️ Skipping instance without dates:', instance.id);
                skippedNoDates++;
                continue;
            }

            // Filter to 60 days on our side
            const startDate = new Date(starts_at);
            if (startDate > sixtyDaysFromNow) {
                skippedBeyond60Days++;
                continue; // Skip events beyond 60 days
            }
            
            // Build resources array from resource requests - DEDUPLICATE by resource_id
            const resourcesMap = new Map();
            if (eventData?.resource_requests) {
                for (const request of eventData.resource_requests) {
                    const resourceId = request.resource_id;
                    
                    // If we already have this resource, merge answers
                    if (resourcesMap.has(resourceId)) {
                        const existing = resourcesMap.get(resourceId);
                        // Merge answers from multiple requests for same resource
                        if (request.answers && request.answers.length > 0) {
                            existing.answers = [...(existing.answers || []), ...request.answers];
                        }
                    } else {
                        // First time seeing this resource
                        resourcesMap.set(resourceId, {
                            id: request.resource_id,
                            name: request.resource_name,
                            kind: request.resource_kind,
                            approval_status: request.approval_status,
                            answers: request.answers || []
                        });
                    }
                }
            }
            
            const resources = Array.from(resourcesMap.values());
            
            eventsWithResources.push({
                id: instance.id,
                event_id: eventId,
                name: eventData?.name || `Event ${eventId}`,
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

        console.log('🎯 Processed', eventsWithResources.length, 'event instances (within 60 days)');
        console.log('⏭️ Skipped', skippedNoDates, 'events without dates');
        console.log('⏭️ Skipped', skippedBeyond60Days, 'events beyond 60 days');
        
        if (eventsWithResources.length > 0) {
            const withResources = eventsWithResources.filter(e => e.resources.length > 0).length;
            const withoutResources = eventsWithResources.filter(e => e.resources.length === 0).length;
            const withAnswers = eventsWithResources.filter(e => 
                e.resources.some(r => r.answers && r.answers.length > 0)
            ).length;
            
            console.log(`📊 Events with resources: ${withResources}`);
            console.log(`📊 Events without resources: ${withoutResources}`);
            console.log(`📊 Events with answers: ${withAnswers}`);
        }

        return Response.json({ 
            events: eventsWithResources,
            count: eventsWithResources.length,
            date_range: {
                start: now.toISOString(),
                end: sixtyDaysFromNow.toISOString()
            },
            stats: {
                total_instances: instances.length,
                unique_events: eventIds.size,
                events_without_names: eventsWithoutNames,
                events_without_resources: eventsWithoutResources,
                skipped_no_dates: skippedNoDates,
                skipped_beyond_60_days: skippedBeyond60Days
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