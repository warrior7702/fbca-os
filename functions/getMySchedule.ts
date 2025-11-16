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
            return Response.json({ events: [], message: 'PCO not connected' });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // Get my PCO person ID
        const meResponse = await fetchWithRetry('https://api.planningcenteronline.com/calendar/v2/me', { headers });
        if (!meResponse.ok) throw new Error('Failed to get PCO person ID');

        const meData = await meResponse.json();
        const myPersonId = meData.data?.id;

        // Get approval groups (first 100)
        const groupsResponse = await fetchWithRetry(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers }
        );

        if (!groupsResponse.ok) throw new Error('Failed to get approval groups');

        const groupsData = await groupsResponse.json();
        const allGroups = groupsData.data || [];

        // Check my groups (limited to speed up)
        const myGroups = [];
        for (const group of allGroups.slice(0, 20)) {
            await delay(50);
            
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
        
        for (const group of myGroups) {
            await delay(50);
            
            const resourcesResponse = await fetchWithRetry(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                { headers }
            );

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                for (const resource of (resourcesData.data || [])) {
                    myResourceIds.add(resource.id);
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

        // Get future event instances (first 2 pages only)
        const now = new Date();
        const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
        
        const instances = [];
        let nextUrl = 'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at';
        let pageCount = 0;
        
        while (nextUrl && pageCount < 2) {
            const response = await fetchWithRetry(nextUrl, { headers });
            if (!response.ok) break;
            
            const data = await response.json();
            instances.push(...(data.data || []));
            nextUrl = data.links?.next;
            pageCount++;
        }
        
        if (instances.length === 0) {
            return Response.json({
                events: [],
                count: 0,
                message: 'No future events found'
            });
        }

        // Get unique event IDs
        const eventIds = new Set();
        instances.forEach(instance => {
            const eventId = instance.relationships?.event?.data?.id;
            if (eventId) eventIds.add(eventId);
        });

        // Process events in OPTIMIZED batches
        const eventsWithMyResources = [];
        const eventIdArray = Array.from(eventIds);
        const batchSize = 8;
        
        for (let i = 0; i < eventIdArray.length; i += batchSize) {
            const batch = eventIdArray.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(async (eventId) => {
                    try {
                        const [eventResponse, requestsResponse, notesResponse, questionsResponse] = await Promise.all([
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}`, { headers }),
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`, { headers }),
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}/notes?per_page=100`, { headers }),
                            fetchWithRetry(`https://api.planningcenteronline.com/calendar/v2/events/${eventId}/resource_questions?per_page=100`, { headers })
                        ]);

                        if (!eventResponse.ok || !requestsResponse.ok) {
                            return { events: [] };
                        }

                        const eventData = await eventResponse.json();
                        const requestsData = await requestsResponse.json();
                        const event = eventData.data;

                        // Get door code from notes
                        let postedDoorCode = null;
                        let accessTime = null;
                        
                        if (notesResponse.ok) {
                            const notesData = await notesResponse.json();
                            for (const note of (notesData.data || [])) {
                                const content = note.attributes?.content || '';
                                const category = note.attributes?.category_name || '';
                                
                                if (category === 'Access' || content.includes('Door Code') || content.includes('door code')) {
                                    const codeMatch = content.match(/(\d{4,6}#?)/);
                                    if (codeMatch) {
                                        postedDoorCode = codeMatch[1].replace('#', '');
                                    } else if (content.toLowerCase().includes('unlock')) {
                                        postedDoorCode = 'unlock';
                                    }
                                }
                                
                                if (category === 'Access' || content.includes('Access Time') || content.includes('access time')) {
                                    const timeMatch = content.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
                                    if (timeMatch) {
                                        accessTime = timeMatch[1];
                                    }
                                }
                            }
                        }

                        // Get questions and answers
                        const questions = questionsResponse.ok ? (await questionsResponse.json()).data || [] : [];
                        
                        const myRequestedResources = [];
                        
                        for (const request of (requestsData.data || [])) {
                            const resourceId = request.relationships?.resource?.data?.id;
                            const resource = requestsData.included?.find(i => i.type === 'Resource' && i.id === resourceId);
                            const resourceName = resource?.attributes?.name || 'Unknown';
                            
                            if (myResourceIds.has(resourceId)) {
                                // Get answers for this request
                                let answers = {};
                                try {
                                    const answersResponse = await fetchWithRetry(
                                        `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request.id}/resource_question_answers?per_page=100`,
                                        { headers }
                                    );
                                    
                                    if (answersResponse.ok) {
                                        const answersData = await answersResponse.json();
                                        for (const answer of (answersData.data || [])) {
                                            const questionId = answer.relationships?.resource_question?.data?.id;
                                            const question = questions.find(q => q.id === questionId);
                                            if (question) {
                                                answers[question.attributes?.question] = answer.attributes?.answer;
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error('Failed to get answers for request:', request.id);
                                }

                                myRequestedResources.push({
                                    id: resourceId,
                                    name: resourceName,
                                    approval_status: request.attributes?.approval_status,
                                    answers: answers
                                });
                            }
                        }

                        if (myRequestedResources.length === 0) {
                            return { events: [] };
                        }

                        // Find instances for this event
                        const eventInstances = instances.filter(i => 
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
                                posted_door_code: postedDoorCode,
                                access_time: accessTime
                            });
                        }
                        
                        return { events };
                    } catch (error) {
                        console.error('Error processing event:', error);
                        return { events: [] };
                    }
                })
            );
            
            for (const result of batchResults) {
                if (result.events) {
                    eventsWithMyResources.push(...result.events);
                }
            }
            
            if (i + batchSize < eventIdArray.length) {
                await delay(200);
            }
        }

        eventsWithMyResources.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

        return Response.json({
            events: eventsWithMyResources,
            count: eventsWithMyResources.length,
            my_groups_count: myGroups.length,
            my_resources_count: myResourceIds.size
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({
            error: error.message,
            events: []
        }, { status: 500 });
    }
});