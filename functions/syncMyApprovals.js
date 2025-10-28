import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Safe array coercion
const A = (x) => Array.isArray(x) ? x : [];
// Safe number coercion
const N = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;

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

        const { forceResync } = await req.json().catch(() => ({ forceResync: false }));

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = A(users)[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                error: 'PCO not connected',
                pending_approvals: [],
                count: 0
            }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        console.log('🔄 Starting sync for:', currentUser.email, 'Force:', forceResync);

        // Get my PCO person ID
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to get PCO user');
        }
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        console.log('👤 My PCO Person ID:', myPcoPersonId);

        // Get ALL approval groups and check membership
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!groupsResponse.ok) {
            throw new Error('Failed to fetch approval groups');
        }

        const groupsData = await groupsResponse.json();
        const myGroupIds = [];
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        // Check each group for membership and map resources
        for (const group of A(groupsData.data)) {
            try {
                // Check membership
                const membersResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (membersResponse.ok) {
                    const membersData = await membersResponse.json();
                    const isMember = A(membersData.data).some(person => person.id === myPcoPersonId);
                    
                    if (isMember) {
                        myGroupIds.push(group.id);
                        myGroupNames[group.id] = group.attributes?.name;
                        console.log('✅ Member of group:', group.attributes?.name);
                    }
                }

                // Map resources to this group
                const resourcesResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );

                if (resourcesResponse.ok) {
                    const resourcesData = await resourcesResponse.json();
                    for (const resource of A(resourcesData.data)) {
                        resourceToGroupMap[resource.id] = {
                            groupId: group.id,
                            groupName: group.attributes?.name
                        };
                    }
                }
            } catch (error) {
                console.error('Error processing group:', group.id, error);
            }
        }

        console.log('📋 I am in', myGroupIds.length, 'groups:', Object.values(myGroupNames));
        console.log('📋 Mapped', Object.keys(resourceToGroupMap).length, 'resources');

        // Fetch ALL pending requests (no date filtering - get everything)
        const eventMap = {};
        const resourceMap = {};
        let allRequests = [];
        let nextUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource&order=-created_at`;
        
        console.log('📥 Fetching pending requests...');
        
        while (nextUrl && allRequests.length < 500) {
            try {
                const requestsResponse = await fetch(nextUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (!requestsResponse.ok) {
                    console.error('Failed to fetch page, status:', requestsResponse.status);
                    break;
                }

                const requestsData = await requestsResponse.json();
                allRequests = allRequests.concat(A(requestsData.data));
                
                // Build maps from included data
                if (requestsData.included) {
                    A(requestsData.included).forEach(item => {
                        try {
                            if (item.type === 'Event') {
                                if (!eventMap[item.id]) eventMap[item.id] = item;
                            } else if (item.type === 'Resource') {
                                if (!resourceMap[item.id]) resourceMap[item.id] = item;
                            }
                        } catch (e) {
                            console.error('Error processing included item:', e);
                        }
                    });
                }
                
                nextUrl = requestsData.links?.next || null;
            } catch (error) {
                console.error('Error fetching page:', error);
                break;
            }
        }

        console.log('📥 Fetched', allRequests.length, 'total pending requests');

        // Filter to only my groups and build approval objects
        const myApprovals = [];
        
        for (const request of A(allRequests)) {
            try {
                const resourceId = request.relationships?.resource?.data?.id;
                const groupInfo = resourceToGroupMap[resourceId];
                
                if (groupInfo && myGroupIds.includes(groupInfo.groupId)) {
                    const eventId = request.relationships?.event?.data?.id;
                    const event = eventMap[eventId];
                    const resource = resourceMap[resourceId];
                    
                    // Fetch event instance for dates
                    let eventStartsAt = null;
                    let eventEndsAt = null;
                    
                    try {
                        const instancesResponse = await fetch(
                            `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_instances?filter=future&per_page=1&order=starts_at`,
                            { headers: { 'Authorization': `Bearer ${accessToken}` } }
                        );
                        
                        if (instancesResponse.ok) {
                            const instancesData = await instancesResponse.json();
                            if (A(instancesData.data).length > 0) {
                                eventStartsAt = instancesData.data[0].attributes?.starts_at;
                                eventEndsAt = instancesData.data[0].attributes?.ends_at;
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching event instance:', err);
                    }
                    
                    myApprovals.push({
                        user_email: currentUser.email,
                        request_id: request.id,
                        event_id: eventId,
                        event_name: event?.attributes?.name || 'Unknown Event',
                        event_starts_at: eventStartsAt,
                        event_ends_at: eventEndsAt,
                        resource_id: resourceId,
                        resource_name: resource?.attributes?.name || 'Unknown Resource',
                        approval_group_name: groupInfo.groupName,
                        quantity: N(request.attributes?.quantity) || 1,
                        approval_status: request.attributes?.approval_status || 'P',
                        pco_created_at: request.attributes?.created_at,
                        pco_updated_at: request.attributes?.updated_at
                    });
                }
            } catch (error) {
                console.error('Error processing request:', error);
            }
        }

        console.log('✅ Found', myApprovals.length, 'approvals for my groups');

        // Clear and recreate all approvals (simpler than diffing)
        const existingApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);

        // Delete all existing
        for (const existing of A(existingApprovals)) {
            try {
                await base44.asServiceRole.entities.PendingApproval.delete(existing.id);
            } catch (error) {
                console.error('Error deleting approval:', error);
            }
        }

        // Create all current
        for (const approval of A(myApprovals)) {
            try {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
            } catch (error) {
                console.error('Error creating approval:', error);
            }
        }

        // Sort by event date
        A(myApprovals).sort((a, b) => {
            const dateA = new Date(a.event_starts_at || a.pco_created_at || 0);
            const dateB = new Date(b.event_starts_at || b.pco_created_at || 0);
            return dateA - dateB;
        });

        console.log('✅ Sync complete:', myApprovals.length, 'pending approvals');

        return Response.json({
            success: true,
            pending_approvals: A(myApprovals),
            count: N(A(myApprovals).length),
            my_groups: A(Object.values(myGroupNames)),
            my_groups_count: N(myGroupIds.length),
            total_fetched: N(allRequests.length),
            cache_bust: Date.now()
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        return Response.json({ 
            error: error.message,
            pending_approvals: [],
            count: 0
        }, { status: 500 });
    }
});