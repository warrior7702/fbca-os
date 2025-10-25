import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Safe array coercion
const A = (x) => Array.isArray(x) ? x : [];
// Safe number coercion
const N = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;

// Stable empty response
const emptyResponse = () => ({
    pending_approvals: [],
    count: 0,
    my_groups: [],
    my_groups_count: 0,
    total_fetched: 0,
    sync_stats: null,
    cache_bust: Date.now()
});

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
            return Response.json({ 
                error: 'Unauthorized',
                ...emptyResponse()
            }, { status: 401 });
        }

        const { forceResync } = await req.json().catch(() => ({ forceResync: false }));

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = A(users)[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                error: 'PCO not connected',
                ...emptyResponse()
            }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Get sync state
        const syncStates = await base44.asServiceRole.entities.ApprovalSyncState.filter({ 
            user_email: currentUser.email 
        }).catch(() => []);
        let syncState = A(syncStates)[0];
        
        let lastSync = null;
        if (!forceResync && syncState?.last_sync) {
            lastSync = new Date(syncState.last_sync);
        } else if (forceResync) {
            // Force resync: go back 90 days
            lastSync = new Date();
            lastSync.setDate(lastSync.getDate() - 90);
        }

        console.log('🔄 Sync started:', {
            user: currentUser.email,
            lastSync: lastSync?.toISOString() || 'full sync',
            forceResync
        });

        // Get my PCO person ID
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!meResponse.ok) {
            console.error('Failed to get PCO user');
            return Response.json({ 
                error: 'Failed to get PCO user',
                ...emptyResponse()
            });
        }
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        // Get all approval groups and find which ones I'm in
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!groupsResponse.ok) {
            console.error('Failed to fetch approval groups');
            return Response.json({ 
                error: 'Failed to fetch approval groups',
                ...emptyResponse()
            });
        }

        const groupsData = await groupsResponse.json();
        const myGroupIds = [];
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        for (const group of A(groupsData.data)) {
            try {
                const membersResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (membersResponse.ok) {
                    const membersData = await membersResponse.json();
                    const isMember = A(membersData.data).some(person => person.id === myPcoPersonId);
                    
                    if (isMember) {
                        myGroupIds.push(group.id);
                        myGroupNames[group.id] = group.attributes?.name;
                    }
                }

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
                // Continue to next group instead of failing completely
            }
        }

        // Build URL with incremental sync filter
        let baseUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource&order=updated_at`;
        
        if (lastSync) {
            const filterDate = lastSync.toISOString();
            baseUrl += `&where[updated_at][gt]=${encodeURIComponent(filterDate)}`;
        }

        // Fetch all pages with error handling
        const eventMap = {};
        const resourceMap = {};
        let allRequests = [];
        let nextUrl = baseUrl;
        let maxUpdatedAt = lastSync || new Date(0);
        
        while (nextUrl) {
            try {
                const requestsResponse = await fetch(nextUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (!requestsResponse.ok) {
                    if (requestsResponse.status === 429) {
                        // Rate limit - wait and retry
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }
                    console.error('Failed to fetch page, skipping...');
                    break; // Skip this page, continue with what we have
                }

                const requestsData = await requestsResponse.json();
                allRequests = allRequests.concat(A(requestsData.data));
                
                // Track max updated_at
                A(requestsData.data).forEach(req => {
                    try {
                        const updatedAt = new Date(req.attributes?.updated_at);
                        if (updatedAt > maxUpdatedAt) {
                            maxUpdatedAt = updatedAt;
                        }
                    } catch (e) {
                        console.error('Error parsing date:', e);
                    }
                });
                
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
                
                if (allRequests.length >= 500) break;
            } catch (error) {
                console.error('Error fetching page:', error);
                break; // Continue with what we have
            }
        }

        // Filter to my groups and fetch event instances
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
                // Continue to next request
            }
        }

        // Reconciliation: Upsert new/updated approvals
        let newUpserts = 0;
        for (const approval of A(myApprovals)) {
            try {
                const existing = await base44.asServiceRole.entities.PendingApproval.filter({
                    user_email: currentUser.email,
                    request_id: approval.request_id
                }).catch(() => []);

                if (A(existing).length > 0) {
                    await base44.asServiceRole.entities.PendingApproval.update(existing[0].id, approval);
                } else {
                    await base44.asServiceRole.entities.PendingApproval.create(approval);
                    newUpserts++;
                }
            } catch (error) {
                console.error('Error upserting approval:', error);
            }
        }

        // Remove closed approvals
        const currentPendingIds = new Set(A(myApprovals).map(a => a.request_id));
        const allStoredApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);
        
        let removed = 0;
        for (const stored of A(allStoredApprovals)) {
            try {
                if (!currentPendingIds.has(stored.request_id)) {
                    await base44.asServiceRole.entities.PendingApproval.delete(stored.id);
                    removed++;
                }
            } catch (error) {
                console.error('Error removing approval:', error);
            }
        }

        // Update sync state
        const syncData = {
            user_email: currentUser.email,
            last_sync: maxUpdatedAt.toISOString(),
            total_fetched: N(allRequests.length),
            new_upserts: N(newUpserts),
            removed: N(removed),
            my_groups: A(Object.values(myGroupNames))
        };

        try {
            if (syncState) {
                await base44.asServiceRole.entities.ApprovalSyncState.update(syncState.id, syncData);
            } else {
                await base44.asServiceRole.entities.ApprovalSyncState.create(syncData);
            }
        } catch (error) {
            console.error('Error updating sync state:', error);
        }

        // Fetch and return sorted approvals
        const finalApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);

        A(finalApprovals).sort((a, b) => {
            const dateA = new Date(a.event_starts_at || a.pco_created_at || 0);
            const dateB = new Date(b.event_starts_at || b.pco_created_at || 0);
            return dateA - dateB;
        });

        console.log('✅ Sync complete:', {
            user: currentUser.email,
            total_fetched: allRequests.length,
            new_upserts: newUpserts,
            removed: removed,
            pending_count: finalApprovals.length
        });

        return Response.json({
            success: true,
            pending_approvals: A(finalApprovals),
            count: N(A(finalApprovals).length),
            my_groups: A(Object.values(myGroupNames)),
            my_groups_count: N(myGroupIds.length),
            total_fetched: N(allRequests.length),
            sync_stats: {
                total_fetched: N(allRequests.length),
                new_upserts: N(newUpserts),
                removed: N(removed),
                last_sync_before: syncState?.last_sync,
                last_sync_after: maxUpdatedAt.toISOString()
            },
            cache_bust: Date.now()
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        return Response.json({ 
            error: error.message,
            ...emptyResponse()
        }, { status: 500 });
    }
});