import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const A = (x) => Array.isArray(x) ? x : [];

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

        console.log('🔄 Starting clean sync for:', currentUser.email);

        // ENV toggles
        const filterByApprover = Deno.env.get('PCO_FILTER_BY_APPROVER') !== 'false'; // default true
        const lookbackDays = parseInt(Deno.env.get('PCO_PENDING_LOOKBACK_DAYS') || '90');
        
        console.log('⚙️ Config:', { filterByApprover, lookbackDays });

        // 1) Get my PCO person ID
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!meResponse.ok) throw new Error('Failed to get PCO user');
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        console.log('👤 My PCO Person ID:', myPcoPersonId);

        // 2) Build my approver group set using Resources API
        const membershipsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/resource_approval_group_memberships?where[person_id]=${myPcoPersonId}&per_page=200`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let myGroupIds = new Set();
        
        if (membershipsResponse.ok) {
            const membershipsData = await membershipsResponse.json();
            myGroupIds = new Set(
                A(membershipsData.data)
                    .map(m => m.relationships?.resource_approval_group?.data?.id)
                    .filter(Boolean)
            );
            console.log('✅ My approval groups:', Array.from(myGroupIds));
        } else {
            console.log('⚠️ Memberships API failed, falling back to manual check');
            
            // Fallback: check each group manually
            const groupsResponse = await fetch(
                'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (groupsResponse.ok) {
                const groupsData = await groupsResponse.json();
                
                for (const group of A(groupsData.data)) {
                    const peopleResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                        { headers: { 'Authorization': `Bearer ${accessToken}` } }
                    );
                    
                    if (peopleResponse.ok) {
                        const peopleData = await peopleResponse.json();
                        const isMember = A(peopleData.data).some(p => p.id === myPcoPersonId);
                        if (isMember) {
                            myGroupIds.add(group.id);
                        }
                    }
                }
            }
        }

        console.log('📋 I am in', myGroupIds.size, 'approval groups');

        // 3) Pull fresh pending approvals (no cursor append - always fresh)
        const requestsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&order=-created_at&per_page=100&include=event,resource',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!requestsResponse.ok) {
            throw new Error('Failed to fetch pending requests');
        }

        const requestsData = await requestsResponse.json();
        
        // Build maps from included data
        const eventMap = {};
        const resourceMap = {};
        const resourceToGroupMap = {};
        
        if (requestsData.included) {
            A(requestsData.included).forEach(item => {
                if (item.type === 'Event') {
                    eventMap[item.id] = item;
                } else if (item.type === 'Resource') {
                    resourceMap[item.id] = item;
                }
            });
        }

        // Map resources to groups
        for (const groupId of myGroupIds) {
            const resourcesResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${groupId}/resources?per_page=100`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                for (const resource of A(resourcesData.data)) {
                    resourceToGroupMap[resource.id] = groupId;
                }
            }
        }

        console.log('📥 Fetched', A(requestsData.data).length, 'total pending requests');

        // 4) Filter to my groups + dedupe + drop non-P + recency guard
        let rows = A(requestsData.data)
            // Hard filter: MUST be pending
            .filter(r => r?.attributes?.approval_status === 'P')
            // Filter by approver if enabled
            .filter(r => {
                if (!filterByApprover) return true;
                const resourceId = r.relationships?.resource?.data?.id;
                const groupId = resourceToGroupMap[resourceId];
                return myGroupIds.has(groupId);
            });

        // Dedupe by id
        rows = [...new Map(rows.map(r => [r.id, r])).values()];

        // Optional recency guard
        if (lookbackDays > 0) {
            const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
            rows = rows.filter(r => {
                const createdAt = new Date(r.attributes?.created_at).getTime();
                return createdAt >= cutoff;
            });
        }

        console.log('✅ Filtered to', rows.length, 'approvals for my groups');

        // 5) Format for Base44
        const myApprovals = [];
        
        for (const request of rows) {
            const eventId = request.relationships?.event?.data?.id;
            const resourceId = request.relationships?.resource?.data?.id;
            const event = eventMap[eventId];
            const resource = resourceMap[resourceId];
            
            // Get event instance for dates
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
                approval_group_name: 'Group', // Will be enriched later
                quantity: request.attributes?.quantity || 1,
                approval_status: 'P',
                pco_created_at: request.attributes?.created_at,
                pco_updated_at: request.attributes?.updated_at
            });
        }

        // Sort by event date
        myApprovals.sort((a, b) => {
            const dateA = new Date(a.event_starts_at || a.pco_created_at || 0);
            const dateB = new Date(b.event_starts_at || b.pco_created_at || 0);
            return dateA - dateB;
        });

        // 6) Clear and recreate all approvals (always fresh)
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
        for (const approval of myApprovals) {
            try {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
            } catch (error) {
                console.error('Error creating approval:', error);
            }
        }

        console.log('✅ Sync complete:', myApprovals.length, 'pending approvals');

        return Response.json({
            success: true,
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.size,
            config: {
                filter_by_approver: filterByApprover,
                lookback_days: lookbackDays
            }
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