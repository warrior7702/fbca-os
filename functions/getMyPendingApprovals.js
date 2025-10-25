import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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
            return Response.json({ pending_approvals: [], message: 'No PCO token found' });
        }

        console.log('Getting my PCO person ID...');
        
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: {
                'Authorization': `Bearer ${user.pco_access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;
        
        console.log('My PCO Person ID:', myPcoPersonId);

        console.log('Getting approval groups...');
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const groupsData = await groupsResponse.json();
        console.log('Found approval groups:', groupsData.data?.length);

        const myGroupIds = [];
        for (const group of groupsData.data || []) {
            const membersResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people`,
                {
                    headers: {
                        'Authorization': `Bearer ${user.pco_access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const membersData = await membersResponse.json();
            
            if (membersData.data?.some(person => person.id === myPcoPersonId)) {
                myGroupIds.push(group.id);
                console.log('Member of group:', group.attributes?.name, 'ID:', group.id);
            }
        }

        console.log('I am in', myGroupIds.length, 'approval groups:', myGroupIds);

        if (myGroupIds.length === 0) {
            return Response.json({ 
                pending_approvals: [], 
                message: 'You are not in any approval groups'
            });
        }

        console.log('Getting pending approvals...');
        const requestsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource`,
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

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
                            'Authorization': `Bearer ${user.pco_access_token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
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

        console.log('Found', myApprovals.length, 'approvals I can act on');
        
        return Response.json({ 
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.length
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message, pending_approvals: [] }, { status: 500 });
    }
});