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

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'PCO not connected' }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // 1. Get my PCO person ID
        const meResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/me',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let myPersonId = null;
        if (meResponse.ok) {
            const meData = await meResponse.json();
            myPersonId = meData.data?.id;
        }

        // 2. Get ALL approval groups
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const groupsData = await groupsResponse.json();
        const allGroups = [];
        const myGroups = [];
        
        for (const group of groupsData.data || []) {
            const groupInfo = {
                id: group.id,
                name: group.attributes?.name,
                is_member: false
            };
            
            // Check if I'm a member
            const membersResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                groupInfo.is_member = membersData.data?.some(person => person.id === myPersonId);
                groupInfo.member_count = membersData.data?.length || 0;
            }
            
            allGroups.push(groupInfo);
            if (groupInfo.is_member) {
                myGroups.push(groupInfo);
            }
        }

        // 3. Get ALL pending event resource requests
        const requestsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        const requestsData = await requestsResponse.json();
        
        // 4. Build resource to group mapping
        const resourceToGroup = {};
        for (const group of groupsData.data || []) {
            const resourcesResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            
            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                for (const resource of resourcesData.data || []) {
                    resourceToGroup[resource.id] = {
                        groupId: group.id,
                        groupName: group.attributes?.name
                    };
                }
            }
        }

        // 5. Filter requests to only those in my groups
        const myRequests = [];
        const otherRequests = [];
        
        for (const request of requestsData.data || []) {
            const resourceId = request.relationships?.resource?.data?.id;
            const groupInfo = resourceToGroup[resourceId];
            const isMyGroup = groupInfo && myGroups.some(g => g.id === groupInfo.groupId);
            
            const requestInfo = {
                id: request.id,
                approval_status: request.attributes?.approval_status,
                quantity: request.attributes?.quantity,
                created_at: request.attributes?.created_at,
                resource_id: resourceId,
                group_name: groupInfo?.groupName || 'No Group',
                is_my_group: isMyGroup
            };
            
            if (isMyGroup) {
                myRequests.push(requestInfo);
            } else {
                otherRequests.push(requestInfo);
            }
        }

        return Response.json({
            summary: {
                my_pco_person_id: myPersonId,
                total_groups: allGroups.length,
                my_groups_count: myGroups.length,
                total_pending_requests: requestsData.data?.length || 0,
                requests_in_my_groups: myRequests.length,
                requests_in_other_groups: otherRequests.length
            },
            my_groups: myGroups,
            all_groups: allGroups,
            my_requests: myRequests,
            other_requests: otherRequests.slice(0, 5), // Just show first 5
            resource_to_group_mapping_count: Object.keys(resourceToGroup).length
        });

    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});