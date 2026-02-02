import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const A = (x) => Array.isArray(x) ? x : [];

// Rate limit helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function fetchWithRetry(url, headers, maxRetries = 2) {
    for (let i = 0; i <= maxRetries; i++) {
        const response = await fetch(url, { headers });
        if (response.ok) return response;
        if (response.status === 429 && i < maxRetries) {
            console.log(`⏳ Rate limited, waiting 2s...`);
            await delay(2000);
            continue;
        }
        return response;
    }
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

        console.log('🔄 Starting sync for:', currentUser.email);

        // Get all approval groups and map resources
        const groupsResponse = await fetchWithRetry(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { 'Authorization': `Bearer ${accessToken}` }
        );

        if (!groupsResponse.ok) throw new Error('Failed to fetch approval groups');

        const groupsData = await groupsResponse.json();
        const myGroupIds = new Set();
        const myGroupNames = {};
        const resourceToGroupMap = {};

        // Map all resources to groups and collect groups with pending requests
        for (const group of A(groupsData.data)) {
            const groupId = group.id;
            const groupName = group.attributes?.name;

            await delay(100); // Small delay between requests

            // Map resources to this group
            const resourcesResponse = await fetchWithRetry(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${groupId}/resources?per_page=100`,
                { 'Authorization': `Bearer ${accessToken}` }
            );

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                for (const resource of A(resourcesData.data)) {
                    resourceToGroupMap[resource.id] = {
                        groupId: groupId,
                        groupName: groupName
                    };
                }
            }

            await delay(100);

            // Check if this group has pending requests
            const requestsResponse = await fetchWithRetry(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${groupId}/event_resource_requests?where[approval_status]=P&per_page=1`,
                { 'Authorization': `Bearer ${accessToken}` }
            );

            if (requestsResponse.ok) {
                const requestsData = await requestsResponse.json();
                if (A(requestsData.data).length > 0) {
                    myGroupIds.add(groupId);
                    myGroupNames[groupId] = groupName;
                    console.log('✅ Group with pending requests:', groupName);
                }
            }
        }

        console.log('📋 Found', myGroupIds.size, 'groups with pending approvals');

        // Get pending requests from MY approval groups
        const allRequests = [];

        for (const groupId of myGroupIds) {
            const requestsResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${groupId}/event_resource_requests?where[approval_status]=P&per_page=100`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (requestsResponse.ok) {
                const requestsData = await requestsResponse.json();
                console.log(`📥 Group ${myGroupNames[groupId]} (${groupId}): ${A(requestsData.data).length} pending requests`);
                allRequests.push(...A(requestsData.data));
            } else {
                console.error(`❌ Failed to fetch requests for group ${groupId}:`, requestsResponse.status);
            }
        }

        console.log('📥 Total fetched:', allRequests.length, 'pending requests from my groups');

        // Process requests and fetch details
        const myApprovals = [];
        const lookbackDays = 90;
        const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

        for (const request of allRequests) {
            // Must be pending
            if (request.attributes?.approval_status !== 'P') continue;

            // Must be recent
            const createdAt = new Date(request.attributes?.created_at).getTime();
            if (createdAt < cutoff) {
                console.log(`⏭️ Skipping old request ${request.id} from ${request.attributes?.created_at}`);
                continue;
            }

            const resourceId = request.relationships?.resource?.data?.id;
            const eventId = request.relationships?.event?.data?.id;
            const groupInfo = resourceToGroupMap[resourceId];

            if (!groupInfo) {
                console.log(`⚠️ No group mapping for resource ${resourceId}, skipping`);
                continue;
            }

            // Fetch event details
            let eventName = 'Unknown Event';
            let eventStartsAt = null;
            let eventEndsAt = null;

            try {
                const eventResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );

                if (eventResponse.ok) {
                    const eventData = await eventResponse.json();
                    eventName = eventData.data?.attributes?.name || 'Unknown Event';
                }
            } catch (err) {
                console.error(`Error fetching event ${eventId}:`, err.message);
            }

            // Fetch event instance for dates
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
                console.error(`Error fetching event instance ${eventId}:`, err.message);
            }

            // Fetch resource details
            let resourceName = 'Unknown Resource';
            try {
                const resourceResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/resources/${resourceId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );

                if (resourceResponse.ok) {
                    const resourceData = await resourceResponse.json();
                    resourceName = resourceData.data?.attributes?.name || 'Unknown Resource';
                }
            } catch (err) {
                console.error(`Error fetching resource ${resourceId}:`, err.message);
            }

            console.log(`✅ Adding approval: ${eventName} - ${resourceName}`);

            myApprovals.push({
                user_email: currentUser.email,
                request_id: request.id,
                event_id: eventId,
                event_name: eventName,
                event_starts_at: eventStartsAt,
                event_ends_at: eventEndsAt,
                resource_id: resourceId,
                resource_name: resourceName,
                approval_group_name: groupInfo.groupName,
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

        console.log('✅ Found', myApprovals.length, 'pending approvals for my groups');

        // Clear and recreate
        const existingApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);

        for (const existing of A(existingApprovals)) {
            try {
                await base44.asServiceRole.entities.PendingApproval.delete(existing.id);
            } catch (error) {
                console.error('Error deleting approval:', error);
            }
        }

        for (const approval of myApprovals) {
            try {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
            } catch (error) {
                console.error('Error creating approval:', error);
            }
        }

        return Response.json({
            success: true,
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.size
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