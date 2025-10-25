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

        const { forceResync } = await req.json().catch(() => ({ forceResync: false }));

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                error: 'PCO not connected',
                pending_approvals: []
            }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Get sync state
        const syncStates = await base44.asServiceRole.entities.ApprovalSyncState.filter({ 
            user_email: currentUser.email 
        });
        let syncState = syncStates[0];
        
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

        if (!meResponse.ok) throw new Error('Failed to get PCO user');
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        // Get all approval groups and find which ones I'm in
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!groupsResponse.ok) throw new Error('Failed to fetch approval groups');

        const groupsData = await groupsResponse.json();
        const myGroupIds = [];
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        for (const group of groupsData.data || []) {
            const membersResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                const isMember = membersData.data?.some(person => person.id === myPcoPersonId);
                
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
                for (const resource of resourcesData.data || []) {
                    resourceToGroupMap[resource.id] = {
                        groupId: group.id,
                        groupName: group.attributes?.name
                    };
                }
            }
        }

        // Build URL with incremental sync filter
        let baseUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource&order=updated_at`;
        
        if (lastSync) {
            const filterDate = lastSync.toISOString();
            baseUrl += `&where[updated_at][gt]=${encodeURIComponent(filterDate)}`;
        }

        // Fetch all pages
        const eventMap = {};
        const resourceMap = {};
        let allRequests = [];
        let nextUrl = baseUrl;
        let maxUpdatedAt = lastSync || new Date(0);
        
        while (nextUrl) {
            const requestsResponse = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!requestsResponse.ok) {
                if (requestsResponse.status === 429) {
                    // Rate limit - wait and retry
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                throw new Error('Failed to fetch requests');
            }

            const requestsData = await requestsResponse.json();
            allRequests = allRequests.concat(requestsData.data || []);
            
            // Track max updated_at
            requestsData.data?.forEach(req => {
                const updatedAt = new Date(req.attributes?.updated_at);
                if (updatedAt > maxUpdatedAt) {
                    maxUpdatedAt = updatedAt;
                }
            });
            
            // Build maps from included data
            if (requestsData.included) {
                requestsData.included.forEach(item => {
                    if (item.type === 'Event') {
                        if (!eventMap[item.id]) eventMap[item.id] = item;
                    } else if (item.type === 'Resource') {
                        if (!resourceMap[item.id]) resourceMap[item.id] = item;
                    }
                });
            }
            
            nextUrl = requestsData.links?.next || null;
            
            if (allRequests.length >= 500) break;
        }

        // Filter to my groups and fetch event instances
        const myApprovals = [];
        
        for (const request of allRequests) {
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
                        if (instancesData.data && instancesData.data.length > 0) {
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
                    quantity: request.attributes?.quantity,
                    approval_status: request.attributes?.approval_status,
                    pco_created_at: request.attributes?.created_at,
                    pco_updated_at: request.attributes?.updated_at
                });
            }
        }

        // Reconciliation: Upsert new/updated approvals
        let newUpserts = 0;
        for (const approval of myApprovals) {
            const existing = await base44.asServiceRole.entities.PendingApproval.filter({
                user_email: currentUser.email,
                request_id: approval.request_id
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.PendingApproval.update(existing[0].id, approval);
            } else {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
                newUpserts++;
            }
        }

        // Remove closed approvals (no longer pending)
        const currentPendingIds = new Set(myApprovals.map(a => a.request_id));
        const allStoredApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        });
        
        let removed = 0;
        for (const stored of allStoredApprovals) {
            if (!currentPendingIds.has(stored.request_id)) {
                await base44.asServiceRole.entities.PendingApproval.delete(stored.id);
                removed++;
            }
        }

        // Update sync state
        const syncData = {
            user_email: currentUser.email,
            last_sync: maxUpdatedAt.toISOString(),
            total_fetched: allRequests.length,
            new_upserts: newUpserts,
            removed: removed,
            my_groups: Object.values(myGroupNames)
        };

        if (syncState) {
            await base44.asServiceRole.entities.ApprovalSyncState.update(syncState.id, syncData);
        } else {
            await base44.asServiceRole.entities.ApprovalSyncState.create(syncData);
        }

        // Fetch and return sorted approvals
        const finalApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        });

        finalApprovals.sort((a, b) => {
            const dateA = new Date(a.event_starts_at || a.pco_created_at);
            const dateB = new Date(b.event_starts_at || b.pco_created_at);
            return dateA - dateB;
        });

        console.log('✅ Sync complete:', {
            user: currentUser.email,
            total_fetched: allRequests.length,
            new_upserts: newUpserts,
            removed: removed,
            pending_count: finalApprovals.length,
            lastSyncBefore: syncState?.last_sync,
            lastSyncAfter: maxUpdatedAt.toISOString()
        });

        return Response.json({
            success: true,
            pending_approvals: finalApprovals,
            count: finalApprovals.length,
            my_groups: Object.values(myGroupNames),
            sync_stats: {
                total_fetched: allRequests.length,
                new_upserts: newUpserts,
                removed: removed,
                last_sync_before: syncState?.last_sync,
                last_sync_after: maxUpdatedAt.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        return Response.json({ 
            error: error.message,
            pending_approvals: []
        }, { status: 500 });
    }
});