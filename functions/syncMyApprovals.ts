import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const A = (x) => Array.isArray(x) ? x : [];

// Helper to add delay between API calls
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

        // Get my PCO person ID
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!meResponse.ok) throw new Error('Failed to get PCO user');
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        console.log('👤 My PCO Person ID:', myPcoPersonId);

        // Get approval groups I'm in
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!groupsResponse.ok) throw new Error('Failed to fetch approval groups');

        const groupsData = await groupsResponse.json();
        const myGroupIds = new Set();
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        for (const group of A(groupsData.data)) {
            await delay(100); // Small delay between calls
            
            // Check if I'm in this group
            const membersResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                const isMember = A(membersData.data).some(person => person.id === myPcoPersonId);
                
                if (isMember) {
                    myGroupIds.add(group.id);
                    myGroupNames[group.id] = group.attributes?.name;
                    console.log('✅ Member of group:', group.attributes?.name);
                }
            }

            await delay(100); // Small delay
            
            // Map resources to groups
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
        }

        console.log('📋 I am in', myGroupIds.size, 'approval groups');

        // Get pending requests
        let allRequests = [];
        let nextUrl = 'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource';
        
        const eventMap = {};
        const resourceMap = {};
        
        let pageCount = 0;
        while (nextUrl && pageCount < 10) { // Limit to 10 pages = 1000 requests
            await delay(200); // Delay between pagination calls
            
            const requestsResponse = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!requestsResponse.ok) {
                console.error('Failed to fetch page', pageCount, '- stopping pagination');
                break;
            }

            const requestsData = await requestsResponse.json();
            allRequests = allRequests.concat(A(requestsData.data));
            
            // Build maps from included data
            if (requestsData.included) {
                A(requestsData.included).forEach(item => {
                    if (item.type === 'Event') {
                        if (!eventMap[item.id]) eventMap[item.id] = item;
                    } else if (item.type === 'Resource') {
                        if (!resourceMap[item.id]) resourceMap[item.id] = item;
                    }
                });
            }
            
            nextUrl = requestsData.links?.next || null;
            pageCount++;
        }

        console.log('📥 Fetched', allRequests.length, 'total pending requests from', pageCount, 'pages');

        // Filter to my groups first (no API calls yet)
        const myGroupRequests = allRequests.filter(request => {
            const resourceId = request.relationships?.resource?.data?.id;
            const groupInfo = resourceToGroupMap[resourceId];
            return groupInfo && myGroupIds.has(groupInfo.groupId) && request.attributes?.approval_status === 'P';
        });

        console.log('📋 Found', myGroupRequests.length, 'pending requests in my groups (before date filtering)');

        // Get all future event instances in ONE call
        const now = new Date();
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        
        console.log('🗓️ Fetching future event instances from', startDate.toISOString(), 'to', endDate.toISOString());
        
        const eventInstanceMap = {};
        let instanceNextUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at`;
        let instancePageCount = 0;
        
        while (instanceNextUrl && instancePageCount < 20) { // Limit to 20 pages = 2000 instances
            await delay(200);
            
            const instancesResponse = await fetch(instanceNextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!instancesResponse.ok) {
                console.error('Failed to fetch instance page', instancePageCount);
                break;
            }
            
            const instancesData = await instancesResponse.json();
            
            for (const instance of A(instancesData.data)) {
                const eventId = instance.relationships?.event?.data?.id;
                if (eventId && !eventInstanceMap[eventId]) {
                    // Store the first (earliest) future instance for each event
                    eventInstanceMap[eventId] = {
                        starts_at: instance.attributes?.starts_at,
                        ends_at: instance.attributes?.ends_at
                    };
                }
            }
            
            instanceNextUrl = instancesData.links?.next || null;
            instancePageCount++;
        }
        
        console.log('✅ Cached', Object.keys(eventInstanceMap).length, 'future event instances');

        // Now build final approvals list using cached data
        const myApprovals = [];
        
        for (const request of myGroupRequests) {
            const resourceId = request.relationships?.resource?.data?.id;
            const eventId = request.relationships?.event?.data?.id;
            const event = eventMap[eventId];
            const resource = resourceMap[resourceId];
            const groupInfo = resourceToGroupMap[resourceId];
            
            // Check if this event has a future instance (using cached data)
            const eventInstance = eventInstanceMap[eventId];
            
            if (!eventInstance) {
                console.log(`⏭️ Skipping past event: ${event?.attributes?.name}`);
                continue;
            }
            
            myApprovals.push({
                user_email: currentUser.email,
                request_id: request.id,
                event_id: eventId,
                event_name: event?.attributes?.name || 'Unknown Event',
                event_starts_at: eventInstance.starts_at,
                event_ends_at: eventInstance.ends_at,
                resource_id: resourceId,
                resource_name: resource?.attributes?.name || 'Unknown Resource',
                approval_group_name: groupInfo.groupName,
                quantity: request.attributes?.quantity || 1,
                approval_status: 'P',
                pco_created_at: request.attributes?.created_at,
                pco_updated_at: request.attributes?.updated_at
            });
        }

        // Sort by event date
        myApprovals.sort((a, b) => {
            const dateA = new Date(a.event_starts_at);
            const dateB = new Date(b.event_starts_at);
            return dateA - dateB;
        });

        console.log('✅ Found', myApprovals.length, 'future pending approvals for my groups');

        // Clear and recreate
        const existingApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);

        console.log('🗑️ Deleting', A(existingApprovals).length, 'existing approvals');

        for (const existing of A(existingApprovals)) {
            try {
                await base44.asServiceRole.entities.PendingApproval.delete(existing.id);
            } catch (error) {
                console.error('Error deleting approval:', error);
            }
        }

        console.log('💾 Creating', myApprovals.length, 'new approvals');

        for (const approval of myApprovals) {
            try {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
            } catch (error) {
                console.error('Error creating approval:', error);
            }
        }

        console.log('✅ Sync complete!');

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