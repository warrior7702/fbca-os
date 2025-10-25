import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    // Check if token needs refresh (within 5 minutes of expiry)
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        console.log('Token still valid');
        return user.pco_access_token;
    }

    console.log('Token expired or expiring soon, refreshing...');

    // Refresh the token
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

    // Update user tokens
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

        // Refresh token if needed
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
                    console.log('Member of group:', group.attributes?.name, 'ID:', group.id);
                }
            }
        }

        console.log('I am in', myGroupIds.length, 'approval groups:', myGroupIds);

        if (myGroupIds.length === 0) {
            return Response.json({ 
                pending_approvals: [], 
                message: 'You are not in any approval groups. Contact your PCO admin if this seems wrong.',
                my_groups_count: 0
            });
        }

        console.log('Getting pending approvals...');
        const requestsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!requestsResponse.ok) {
            const errorText = await requestsResponse.text();
            console.error('Failed to get requests:', errorText);
            throw new Error('Failed to fetch resource requests');
        }

        const requestsData = await requestsResponse.json();
        console.log('Found total pending requests:', requestsData.data?.length);
        
        const eventMap = {};
        const resourceMap = {};
        
        if (requestsData.included) {
            requestsData.included.forEach(item => {
                if (item.type === 'Event') {
                    eventMap[item.id] = item;
                } else if (item.type === 'Resource') {
                    resourceMap[item.id] = item;
                }
            });
        }

        const myApprovals = [];
        
        for (const request of requestsData.data || []) {
            const resourceId = request.relationships?.resource?.data?.id;
            const resource = resourceMap[resourceId];
            
            if (resource) {
                console.log('Checking resource:', resource.attributes?.name);
                
                const resourceDetailResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/resources/${resourceId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                if (resourceDetailResponse.ok) {
                    const resourceDetail = await resourceDetailResponse.json();
                    const approvalGroupId = resourceDetail.data?.relationships?.resource_approval_group?.data?.id;
                    
                    console.log('  - Resource approval group ID:', approvalGroupId);
                    console.log('  - Is in my groups?', myGroupIds.includes(approvalGroupId));
                    
                    if (myGroupIds.includes(approvalGroupId)) {
                        const eventId = request.relationships?.event?.data?.id;
                        myApprovals.push({
                            ...request,
                            event_name: eventMap[eventId]?.attributes?.name || 'Unknown Event',
                            resource_name: resource.attributes?.name || 'Unknown Resource'
                        });
                        console.log('  - MATCH! Added to my approvals');
                    }
                }
            }
        }

        console.log('Found', myApprovals.length, 'approvals I can act on');
        
        return Response.json({ 
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.length
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