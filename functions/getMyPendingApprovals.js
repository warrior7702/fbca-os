import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        console.log('Token still valid');
        return user.pco_access_token;
    }

    console.log('Token expired or expiring soon, refreshing...');

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.pco_refresh_token,
            client_id: Deno.env.get('PCO_CLIENT_ID'),
            client_secret: Deno.env.get('PCO_CLIENT_SECRET')
        })
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        throw new Error('PCO token refresh failed. Please reconnect in Settings.');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
    });

    console.log('Token refreshed successfully');
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
            return Response.json({ 
                pending_approvals: [], 
                message: 'PCO not connected. Please connect in Settings > Integrations' 
            });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        console.log('Getting my PCO person ID...');
        
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!meResponse.ok) {
            const errorText = await meResponse.text();
            console.error('Failed to get PCO user:', errorText);
            throw new Error('Failed to authenticate with Planning Center');
        }
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;
        
        console.log('My PCO Person ID:', myPcoPersonId);

        console.log('Getting approval groups...');
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!groupsResponse.ok) {
            const errorText = await groupsResponse.text();
            console.error('Failed to get approval groups:', errorText);
            throw new Error('Failed to fetch approval groups');
        }

        const groupsData = await groupsResponse.json();
        console.log('Found approval groups:', groupsData.data?.length);

        const myGroupIds = [];
        const myGroupNames = {};
        
        for (const group of groupsData.data || []) {
            const membersResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                
                if (membersData.data?.some(person => person.id === myPcoPersonId)) {
                    myGroupIds.push(group.id);
                    myGroupNames[group.id] = group.attributes?.name;
                    console.log('✓ Member of group:', group.attributes?.name, 'ID:', group.id);
                }
            }
        }

        console.log('I am in', myGroupIds.length, 'approval groups:', Object.values(myGroupNames));

        if (myGroupIds.length === 0) {
            return Response.json({ 
                pending_approvals: [], 
                message: 'You are not in any approval groups',
                my_groups_count: 0
            });
        }

        console.log('Getting pending resource requests with approval groups included...');
        
        // Include resource_approval_group in the query so we don't need separate API calls
        const requestsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource,resource.resource_approval_group`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!requestsResponse.ok) {
            const errorText = await requestsResponse.text();
            console.error('Failed to get pending requests:', errorText);
            throw new Error('Failed to fetch pending resource requests');
        }

        const requestsData = await requestsResponse.json();
        console.log('Found PENDING requests:', requestsData.data?.length);
        
        // Build maps from included data
        const eventMap = {};
        const resourceMap = {};
        const approvalGroupMap = {};
        
        if (requestsData.included) {
            requestsData.included.forEach(item => {
                if (item.type === 'Event') {
                    eventMap[item.id] = item;
                } else if (item.type === 'Resource') {
                    resourceMap[item.id] = item;
                } else if (item.type === 'ResourceApprovalGroup') {
                    approvalGroupMap[item.id] = item;
                }
            });
        }

        console.log('Found', Object.keys(resourceMap).length, 'resources');
        console.log('Found', Object.keys(approvalGroupMap).length, 'approval groups in response');

        const myApprovals = [];
        const debugInfo = [];
        
        for (const request of requestsData.data || []) {
            const resourceId = request.relationships?.resource?.data?.id;
            const resource = resourceMap[resourceId];
            
            if (resource) {
                const approvalGroupId = resource.relationships?.resource_approval_group?.data?.id;
                const approvalGroup = approvalGroupMap[approvalGroupId];
                const isInMyGroups = myGroupIds.includes(approvalGroupId);
                
                console.log('Resource:', resource.attributes?.name, 
                           'Approval Group ID:', approvalGroupId,
                           'Approval Group Name:', approvalGroup?.attributes?.name,
                           'Is in my groups:', isInMyGroups);
                
                debugInfo.push({
                    resource_name: resource.attributes?.name,
                    resource_id: resourceId,
                    approval_group_id: approvalGroupId,
                    approval_group_name: approvalGroup?.attributes?.name,
                    my_group_name: myGroupNames[approvalGroupId],
                    is_in_my_groups: isInMyGroups
                });
                
                if (isInMyGroups) {
                    const eventId = request.relationships?.event?.data?.id;
                    const event = eventMap[eventId];
                    
                    myApprovals.push({
                        id: request.id,
                        event_id: eventId,
                        event_name: event?.attributes?.name || 'Unknown Event',
                        event_starts_at: event?.attributes?.starts_at,
                        event_ends_at: event?.attributes?.ends_at,
                        resource_id: resourceId,
                        resource_name: resource.attributes?.name || 'Unknown Resource',
                        approval_group_name: approvalGroup?.attributes?.name,
                        quantity: request.attributes?.quantity,
                        created_at: request.attributes?.created_at,
                        approval_status: request.attributes?.approval_status
                    });
                    console.log('  ✓ MATCH! Added to my approvals');
                }
            }
        }

        console.log('Found', myApprovals.length, 'approvals I can act on');
        
        return Response.json({ 
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.length,
            my_groups: Object.values(myGroupNames),
            debug: debugInfo,
            total_pending_in_system: requestsData.data?.length
        });

    } catch (error) {
        console.error('Error in getMyPendingApprovals:', error);
        return Response.json({ 
            error: error.message, 
            pending_approvals: [],
            details: 'Check function logs for more information'
        }, { status: 500 });
    }
});