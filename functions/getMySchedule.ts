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

// Helper to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry on 429
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
            if (attempt < maxRetries) {
                const waitTime = attempt * 1000;
                console.warn(`⚠️ Rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
                await delay(waitTime);
                continue;
            }
        }
        
        return response;
    }
    
    throw new Error('Rate limit exceeded after retries');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            console.error('❌ No current user');
            return Response.json({ error: 'Unauthorized', events: [] }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ events: [], message: 'PCO not connected' });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // Get my PCO person ID
        const meResponse = await fetchWithRetry(
            'https://api.planningcenteronline.com/calendar/v2/me',
            { headers }
        );

        if (!meResponse.ok) throw new Error('Failed to get PCO person ID');

        const meData = await meResponse.json();
        const myPersonId = meData.data?.id;

        // Get approval groups I'm in
        const groupsResponse = await fetchWithRetry(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers }
        );

        if (!groupsResponse.ok) throw new Error('Failed to get approval groups');

        const groupsData = await groupsResponse.json();
        const allGroups = groupsData.data || [];

        const myGroups = [];
        for (const group of allGroups) {
            await delay(100);
            
            const membersResponse = await fetchWithRetry(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                { headers }
            );

            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                const isMember = membersData.data?.some(m => m.id === myPersonId);
                
                if (isMember) {
                    myGroups.push({ id: group.id, name: group.attributes?.name });
                }
            }
        }

        if (myGroups.length === 0) {
            return Response.json({
                events: [],
                count: 0,
                message: 'You are not in any approval groups'
            });
        }

        // Get resources for my groups
        const myResourceIds = new Set();
        const myResources = [];
        
        for (const group of myGroups) {
            await delay(100);
            
            const resourcesResponse = await fetchWithRetry(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                { headers }
            );

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                for (const resource of (resourcesData.data || [])) {
                    myResourceIds.add(resource.id);
                    myResources.push({
                        id: resource.id,
                        name: resource.attributes?.name,
                        kind: resource.attributes?.kind,
                        group: group.name
                    });
                }
            }
        }

        if (myResourceIds.size === 0) {
            return Response.json({
                events: [],
                count: 0,
                message: 'No resources assigned to your approval groups'
            });
        }

        // Get future event instances
        const now = new Date();
        const twoWeeksFromNow = new Date(now);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        
        const instancesResponse = await fetchWithRetry(
            `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at`,
            { headers }
        );

        if (!instancesResponse.ok) {
            throw new Error('Failed to fetch event instances');
        }

        const instancesData = await instancesResponse.json();
        const allInstances = instancesData.data || [];
        
        if (allInstances.length === 0) {
            return Response.json({
                events: [],
                count: 0,
                message: 'No future events found in PCO Calendar'
            });
        }

        // Get unique event IDs
        const eventIds = new Set();
        allInstances.forEach(instance => {
            const eventId = instance.relationships?.event?.data?.id;
            if (eventId) eventIds.add(eventId);
        });

        // Process events in SMALLER BATCHES with RETRIES
        const eventsWithMyResources = [];
        const eventIdArray = Array.from(eventIds);
        const batchSize = 5; // REDUCED from previous implementation
        
        console.log(`📦 Processing ${eventIdArray.length} events in batches of ${batchSize}...`);
        
        for (let i = 0; i < eventIdArray.length; i += batchSize) {
            const batch = eventIdArray.slice(i, i + batchSize);
            console.log(`🔄 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eventIdArray.length / batchSize)}`);
            
            const batchResults = await Promise.all(
                batch.map(async (eventId) => {
                    try {
                        // Fetch event and requests WITH RETRIES
                        const [eventResponse, requestsResponse] = await Promise.all([
                            fetchWithRetry(
                                `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
                                { headers },
                                3
                            ),
                            fetchWithRetry(
                                `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`,
                                { headers },
                                3
                            )
                        ]);

                        if (!eventResponse.ok || !requestsResponse.ok) {
                            console.warn(`⚠️ Failed to fetch event ${eventId}`);
                            return { events: [] };
                        }

                        const eventData = await eventResponse.json();
                        const requestsData = await requestsResponse.json();
                        const event = eventData.data;

                        // Check resources
                        const myRequestedResources = [];
                        const buildingAccessRequests = [];
                        
                        for (const request of (requestsData.data || [])) {
                            const resourceId = request.relationships?.resource?.data?.id;
                            const resource = requestsData.included?.find(i => i.type === 'Resource' && i.id === resourceId);
                            const resourceName = resource?.attributes?.name || 'Unknown';
                            
                            if (myResourceIds.has(resourceId)) {
                                myRequestedResources.push({
                                    id: resourceId,
                                    name: resourceName,
                                    approval_status: request.attributes?.approval_status
                                });
                                
                                const isBuildingAccess = resourceName.toLowerCase().includes('building access') || 
                                                       resourceName.toLowerCase().includes('door code') ||
                                                       resourceName.toLowerCase().includes('access code');
                                
                                if (isBuildingAccess && request.id) {
                                    buildingAccessRequests.push(request.id);
                                }
                            }
                        }

                        if (myRequestedResources.length === 0) {
                            return { events: [] };
                        }

                        // Fetch answers ONLY for building access WITH RETRIES
                        let accessTime = null;
                        
                        if (buildingAccessRequests.length > 0) {
                            try {
                                for (const requestId of buildingAccessRequests) {
                                    await delay(100);
                                    
                                    const answersResponse = await fetchWithRetry(
                                        `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${requestId}/answers?per_page=100`,
                                        { headers },
                                        2
                                    );

                                    if (answersResponse.ok) {
                                        const answersData = await answersResponse.json();
                                        
                                        for (const answer of (answersData.data || [])) {
                                            const questionAttr = answer.attributes?.question;
                                            const questionText = typeof questionAttr === 'string' ? questionAttr : 
                                                               (questionAttr?.question || questionAttr?.text || '');
                                            
                                            const question = String(questionText || '').toLowerCase();
                                            let value = answer.attributes?.value || answer.attributes?.answer || answer.attributes?.text;
                                            
                                            if (typeof value === 'object' && value !== null) {
                                                value = JSON.stringify(value);
                                            }
                                            
                                            const answerText = String(value || '').toLowerCase();
                                            
                                            const isAccessQuestion = question.includes('access') || 
                                                                   question.includes('time') || 
                                                                   question.includes('begin') || 
                                                                   question.includes('end') ||
                                                                   question.includes('other details');
                                            
                                            const looksLikeTimeRange = answerText.includes('am') || answerText.includes('pm') || 
                                                                       /\d+:\d+/.test(answerText);
                                            
                                            if (isAccessQuestion && looksLikeTimeRange) {
                                                accessTime = String(value);
                                                break;
                                            }
                                        }
                                    }
                                    
                                    if (accessTime) break;
                                }
                            } catch (error) {
                                console.warn('Warning: Error fetching answers:', error.message);
                            }
                        }

                        // Find instances for this event
                        const eventInstances = allInstances.filter(i => 
                            i.relationships?.event?.data?.id === eventId
                        );

                        const events = [];
                        for (const instance of eventInstances) {
                            const startsAt = instance.attributes?.starts_at;
                            const endsAt = instance.attributes?.ends_at;
                            
                            if (!startsAt) continue;
                            
                            const startDate = new Date(startsAt);
                            if (startDate > twoWeeksFromNow) continue;

                            events.push({
                                id: instance.id,
                                event_id: eventId,
                                name: event.attributes?.name || 'Untitled Event',
                                starts_at: startsAt,
                                ends_at: endsAt,
                                summary: event.attributes?.summary,
                                resources: myRequestedResources,
                                access_time: accessTime
                            });
                        }
                        
                        return { events };
                    } catch (error) {
                        console.error('❌ Error processing event', eventId, ':', error.message);
                        return { events: [] };
                    }
                })
            );
            
            // Collect results
            for (const result of batchResults) {
                if (result.events) {
                    eventsWithMyResources.push(...result.events);
                }
            }
            
            // Delay between batches
            if (i + batchSize < eventIdArray.length) {
                await delay(500);
            }
        }

        // Sort by start date
        eventsWithMyResources.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

        console.log(`✅ Finished: ${eventsWithMyResources.length} events with my resources`);

        return Response.json({
            events: eventsWithMyResources,
            count: eventsWithMyResources.length,
            my_groups_count: myGroups.length,
            my_resources_count: myResourceIds.size
        });

    } catch (error) {
        console.error('❌ Get my schedule error:', error);
        return Response.json({
            error: error.message,
            events: []
        }, { status: 500 });
    }
});