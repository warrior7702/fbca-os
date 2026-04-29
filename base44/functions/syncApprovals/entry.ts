import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { fetchPCO } from './utils/pcoConfig.js';

const A = (x) => Array.isArray(x) ? x : [];
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

        // Get my PCO person ID
        const meResponse = await fetchPCO(base44, '/calendar/v2/me', accessToken);
        if (!meResponse.ok) throw new Error('Failed to get PCO user');
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        // Get ALL approval groups
        const groupsResponse = await fetchPCO(
            base44,
            '/calendar/v2/resource_approval_groups?per_page=100',
            accessToken
        );

        if (!groupsResponse.ok) throw new Error('Failed to fetch approval groups');

        const groupsData = await groupsResponse.json();
        const allGroups = A(groupsData.data);
        
        // Check which groups I'm in
        const myGroupIds = new Set();
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        for (const group of allGroups) {
            await delay(100);
            
            const membersResponse = await fetchPCO(
                base44,
                `/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                accessToken
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                const members = A(membersData.data);
                const isMember = members.some(person => person.id === myPcoPersonId);
                
                if (isMember) {
                    myGroupIds.add(group.id);
                    myGroupNames[group.id] = group.attributes?.name;
                }
            }

            await delay(100);
            
            // Map resources to groups
            const resourcesResponse = await fetchPCO(
                base44,
                `/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                accessToken
            );

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                const resources = A(resourcesData.data);
                
                for (const resource of resources) {
                    resourceToGroupMap[resource.id] = {
                        groupId: group.id,
                        groupName: group.attributes?.name
                    };
                }
            }
        }

        if (myGroupIds.size === 0) {
            return Response.json({
                success: true,
                pending_approvals: [],
                count: 0,
                my_groups_count: 0,
                message: 'You are not a member of any approval groups in Planning Center'
            });
        }

        // Get pending requests
        let allRequests = [];
        let nextUrl = '/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource';
        
        const eventMap = {};
        const resourceMap = {};
        
        let pageCount = 0;
        while (nextUrl && pageCount < 10) {
            await delay(200);
            
            const requestsResponse = await fetchPCO(base44, nextUrl, accessToken);
            if (!requestsResponse.ok) break;

            const requestsData = await requestsResponse.json();
            const pageRequests = A(requestsData.data);
            allRequests = allRequests.concat(pageRequests);
            
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

        // Filter to my groups
        const myGroupRequests = allRequests.filter(request => {
            const resourceId = request.relationships?.resource?.data?.id;
            const groupInfo = resourceToGroupMap[resourceId];
            const isMyGroup = groupInfo && myGroupIds.has(groupInfo.groupId);
            const isPending = request.attributes?.approval_status === 'P';
            return isMyGroup && isPending;
        });

        // Get future event instances
        const eventInstanceMap = {};
        let instanceNextUrl = `/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at`;
        let instancePageCount = 0;
        
        while (instanceNextUrl && instancePageCount < 20) {
            await delay(200);
            
            const instancesResponse = await fetchPCO(base44, instanceNextUrl, accessToken);
            if (!instancesResponse.ok) break;
            
            const instancesData = await instancesResponse.json();
            const pageInstances = A(instancesData.data);
            
            for (const instance of pageInstances) {
                const eventId = instance.relationships?.event?.data?.id;
                if (eventId && !eventInstanceMap[eventId]) {
                    eventInstanceMap[eventId] = {
                        starts_at: instance.attributes?.starts_at,
                        ends_at: instance.attributes?.ends_at
                    };
                }
            }
            
            instanceNextUrl = instancesData.links?.next || null;
            instancePageCount++;
        }

        // Build final approvals list
        const myApprovals = [];
        
        for (const request of myGroupRequests) {
            const resourceId = request.relationships?.resource?.data?.id;
            const eventId = request.relationships?.event?.data?.id;
            const event = eventMap[eventId];
            const resource = resourceMap[resourceId];
            const groupInfo = resourceToGroupMap[resourceId];
            
            const eventInstance = eventInstanceMap[eventId];
            if (!eventInstance) continue;
            
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

        // Clear and recreate database records
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
            my_groups_count: myGroupIds.size,
            debug: {
                total_groups: allGroups.length,
                my_groups: Array.from(myGroupIds).map(id => myGroupNames[id]),
                total_pending_requests: allRequests.length,
                my_group_requests: myGroupRequests.length,
                future_events_cached: Object.keys(eventInstanceMap).length
            }
        });

    } catch (error) {
        console.error('Error in syncApprovals:', error);
        return Response.json({ 
            error: error.message,
            pending_approvals: [],
            count: 0
        }, { status: 500 });
    }
});