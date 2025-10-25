
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    console.log('Refreshing token...');
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
            return Response.json({ 
                pending_approvals: [], 
                message: 'PCO not connected' 
            });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Get my PCO person ID
        const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!meResponse.ok) throw new Error('Failed to get PCO user');
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;

        console.log('My PCO Person ID:', myPcoPersonId);

        // Get all approval groups and find which ones I'm in
        const groupsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!groupsResponse.ok) throw new Error('Failed to fetch approval groups');

        const groupsData = await groupsResponse.json();
        const myGroupIds = [];
        const myGroupNames = {};
        
        // Build a map of resources to approval groups
        const resourceToGroupMap = {};
        
        for (const group of groupsData.data || []) {
            // Check if I'm in this group
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
                    console.log('✓ Member of group:', group.attributes?.name);
                }
            }

            // Get all resources in this group
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

        console.log('Resource to Group Map:', Object.keys(resourceToGroupMap).length, 'resources mapped');
        console.log('I am in', myGroupIds.length, 'groups:', Object.values(myGroupNames));

        // Get pending requests, including event, resource, answers, and resource form
        const requestsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource,answers,resource.resource_form`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!requestsResponse.ok) throw new Error('Failed to fetch requests');

        const requestsData = await requestsResponse.json();
        
        // Build maps from included data
        const eventMap = {};
        const resourceMap = {};
        const answersMap = {}; // Map answer ID to answer object
        const resourceFormMap = {}; // Map resource form ID to resource form object
        
        if (requestsData.included) {
            requestsData.included.forEach(item => {
                if (item.type === 'Event') eventMap[item.id] = item;
                else if (item.type === 'Resource') resourceMap[item.id] = item;
                else if (item.type === 'Answer') answersMap[item.id] = item;
                else if (item.type === 'ResourceForm') resourceFormMap[item.id] = item;
            });
        }

        const myApprovals = [];
        const debugInfo = [];
        
        for (const request of requestsData.data || []) {
            const resourceId = request.relationships?.resource?.data?.id;
            const resource = resourceMap[resourceId];
            const groupInfo = resourceToGroupMap[resourceId];
            
            const isInMyGroups = groupInfo && myGroupIds.includes(groupInfo.groupId);
            
            debugInfo.push({
                resource_name: resource?.attributes?.name,
                resource_id: resourceId,
                approval_group: groupInfo?.groupName || 'None',
                is_in_my_groups: isInMyGroups
            });
            
            if (isInMyGroups) {
                const eventId = request.relationships?.event?.data?.id;
                const event = eventMap[eventId];

                const questionsAndAnswers = [];
                const resourceFormId = resource?.relationships?.resource_form?.data?.id;
                const resourceForm = resourceFormMap[resourceFormId];
                
                if (resourceForm?.attributes?.questions && Array.isArray(resourceForm.attributes.questions)) {
                    const requestAnswers = request.relationships?.answers?.data || [];
                    const answersForRequest = requestAnswers
                        .map(answerRel => answersMap[answerRel.id])
                        .filter(Boolean); // Filter out any null/undefined answers
                    
                    resourceForm.attributes.questions.forEach(question => {
                        const answer = answersForRequest.find(ans => ans.attributes?.question_id === question.id);
                        questionsAndAnswers.push({
                            question_id: question.id,
                            question_text: question.text,
                            question_type: question.type,
                            answer_value: answer?.attributes?.value || null
                        });
                    });
                }
                
                myApprovals.push({
                    id: request.id,
                    event_id: eventId,
                    event_name: event?.attributes?.name || 'Unknown Event',
                    event_starts_at: event?.attributes?.starts_at,
                    event_ends_at: event?.attributes?.ends_at,
                    resource_id: resourceId,
                    resource_name: resource?.attributes?.name || 'Unknown Resource',
                    approval_group_name: groupInfo.groupName,
                    quantity: request.attributes?.quantity,
                    created_at: request.attributes?.created_at,
                    approval_status: request.attributes?.approval_status,
                    questions: questionsAndAnswers
                });
                console.log('✓ MATCH! Found approval for', resource?.attributes?.name);
            }
        }

        console.log('Found', myApprovals.length, 'approvals I can act on');
        
        return Response.json({ 
            pending_approvals: myApprovals,
            count: myApprovals.length,
            my_groups_count: myGroupIds.length,
            my_groups: Object.values(myGroupNames),
            debug: debugInfo.slice(0, 20),
            total_pending_in_system: requestsData.data?.length
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            error: error.message, 
            pending_approvals: []
        }, { status: 500 });
    }
});
