import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { fetchPCO } from './utils/pcoConfig.js';

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
    console.log('========================================');
    console.log('🔄 SYNC MY APPROVALS - DETAILED DEBUG');
    console.log('========================================');
    
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            console.log('❌ No authenticated user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('✅ User:', currentUser.email);

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = A(users)[0];

        if (!user || !user.pco_access_token) {
            console.log('❌ No PCO token for user');
            return Response.json({ 
                error: 'PCO not connected',
                pending_approvals: [],
                count: 0
            }, { status: 400 });
        }

        console.log('✅ PCO token found');
        const accessToken = await refreshTokenIfNeeded(base44, user);

        // STEP 1: Get my PCO person ID
        console.log('📝 STEP 1: Getting my PCO person ID...');
        const meResponse = await fetchPCO(
            base44,
            '/calendar/v2/me',
            accessToken
        );

        if (!meResponse.ok) {
            console.log('❌ Failed to get PCO user:', meResponse.status);
            throw new Error('Failed to get PCO user');
        }
        
        const meData = await meResponse.json();
        const myPcoPersonId = meData.data?.id;
        console.log('✅ My PCO Person ID:', myPcoPersonId);

        // STEP 2: Get ALL approval groups
        console.log('📝 STEP 2: Getting all approval groups...');
        const groupsResponse = await fetchPCO(
            base44,
            '/calendar/v2/resource_approval_groups?per_page=100',
            accessToken
        );

        if (!groupsResponse.ok) {
            console.log('❌ Failed to fetch approval groups:', groupsResponse.status);
            throw new Error('Failed to fetch approval groups');
        }

        const groupsData = await groupsResponse.json();
        const allGroups = A(groupsData.data);
        console.log('✅ Total approval groups in PCO:', allGroups.length);
        
        allGroups.forEach((group, idx) => {
            console.log(`  ${idx + 1}. ${group.attributes?.name} (ID: ${group.id})`);
        });

        // STEP 3: Check which groups I'm in
        console.log('📝 STEP 3: Checking my membership in each group...');
        const myGroupIds = new Set();
        const myGroupNames = {};
        const resourceToGroupMap = {};
        
        for (const group of allGroups) {
            await delay(100);
            
            console.log(`🔍 Checking group: ${group.attributes?.name}`);
            
            const membersResponse = await fetchPCO(
                base44,
                `/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
                accessToken
            );
            
            if (membersResponse.ok) {
                const membersData = await membersResponse.json();
                const members = A(membersData.data);
                
                console.log(`  - Found ${members.length} members in this group`);
                members.forEach(member => {
                    console.log(`    • ${member.attributes?.name} (ID: ${member.id})`);
                });
                
                const isMember = members.some(person => person.id === myPcoPersonId);
                
                if (isMember) {
                    myGroupIds.add(group.id);
                    myGroupNames[group.id] = group.attributes?.name;
                    console.log(`  ✅ I AM a member of "${group.attributes?.name}"`);
                } else {
                    console.log(`  ❌ I am NOT a member of "${group.attributes?.name}"`);
                }
            } else {
                console.log(`  ⚠️ Failed to fetch members for group ${group.id}: ${membersResponse.status}`);
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
                console.log(`  - ${resources.length} resources in this group`);
                
                for (const resource of resources) {
                    resourceToGroupMap[resource.id] = {
                        groupId: group.id,
                        groupName: group.attributes?.name
                    };
                }
            }
        }

        console.log('========================================');
        console.log(`📊 SUMMARY: I am in ${myGroupIds.size} approval groups:`);
        Array.from(myGroupIds).forEach(groupId => {
            console.log(`  ✅ ${myGroupNames[groupId]}`);
        });
        console.log('========================================');

        if (myGroupIds.size === 0) {
            console.log('⚠️ YOU ARE NOT IN ANY APPROVAL GROUPS!');
            console.log('This means you will see no approvals.');
            return Response.json({
                success: true,
                pending_approvals: [],
                count: 0,
                my_groups_count: 0,
                message: 'You are not a member of any approval groups in Planning Center'
            });
        }

        // STEP 4: Get pending requests
        console.log('📝 STEP 4: Fetching all pending resource requests...');
        let allRequests = [];
        let nextUrl = '/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource';
        
        const eventMap = {};
        const resourceMap = {};
        
        let pageCount = 0;
        while (nextUrl && pageCount < 10) {
            await delay(200);
            
            console.log(`  - Fetching page ${pageCount + 1}...`);
            
            const requestsResponse = await fetchPCO(base44, nextUrl, accessToken);

            if (!requestsResponse.ok) {
                console.log(`  ❌ Failed to fetch page ${pageCount + 1}: ${requestsResponse.status}`);
                break;
            }

            const requestsData = await requestsResponse.json();
            const pageRequests = A(requestsData.data);
            allRequests = allRequests.concat(pageRequests);
            console.log(`  ✅ Got ${pageRequests.length} requests (total: ${allRequests.length})`);
            
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

        console.log(`✅ Fetched ${allRequests.length} total pending requests from ${pageCount} pages`);

        // STEP 5: Filter to my groups
        console.log('📝 STEP 5: Filtering requests to my approval groups...');
        const myGroupRequests = allRequests.filter(request => {
            const resourceId = request.relationships?.resource?.data?.id;
            const groupInfo = resourceToGroupMap[resourceId];
            const isMyGroup = groupInfo && myGroupIds.has(groupInfo.groupId);
            const isPending = request.attributes?.approval_status === 'P';
            return isMyGroup && isPending;
        });

        console.log(`✅ Found ${myGroupRequests.length} pending requests in my groups (before date filtering)`);

        if (myGroupRequests.length === 0) {
            console.log('⚠️ NO REQUESTS FOUND FOR YOUR APPROVAL GROUPS!');
            console.log('This could mean:');
            console.log('  1. No one has requested resources from your groups');
            console.log('  2. All requests have been approved/rejected');
            console.log('  3. The resources in your groups are not being used in events');
        }

        // STEP 6: Get future event instances
        console.log('📝 STEP 6: Fetching future event instances...');
        const now = new Date();
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        
        const eventInstanceMap = {};
        let instanceNextUrl = `/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at`;
        let instancePageCount = 0;
        
        while (instanceNextUrl && instancePageCount < 20) {
            await delay(200);
            
            console.log(`  - Fetching instance page ${instancePageCount + 1}...`);
            
            const instancesResponse = await fetchPCO(base44, instanceNextUrl, accessToken);
            
            if (!instancesResponse.ok) {
                console.log(`  ❌ Failed to fetch instance page ${instancePageCount + 1}: ${instancesResponse.status}`);
                break;
            }
            
            const instancesData = await instancesResponse.json();
            const pageInstances = A(instancesData.data);
            
            console.log(`  ✅ Got ${pageInstances.length} instances`);
            
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
        
        console.log(`✅ Cached ${Object.keys(eventInstanceMap).length} future event instances`);

        // STEP 7: Build final approvals list
        console.log('📝 STEP 7: Building final approvals list...');
        const myApprovals = [];
        
        for (const request of myGroupRequests) {
            const resourceId = request.relationships?.resource?.data?.id;
            const eventId = request.relationships?.event?.data?.id;
            const event = eventMap[eventId];
            const resource = resourceMap[resourceId];
            const groupInfo = resourceToGroupMap[resourceId];
            
            const eventInstance = eventInstanceMap[eventId];
            
            if (!eventInstance) {
                console.log(`  ⏭️ Skipping past event: ${event?.attributes?.name} (event ID: ${eventId})`);
                continue;
            }
            
            console.log(`  ✅ Including: ${event?.attributes?.name} - ${resource?.attributes?.name}`);
            
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

        console.log('========================================');
        console.log(`✅ FINAL RESULT: ${myApprovals.length} future pending approvals`);
        console.log('========================================');

        if (myApprovals.length === 0) {
            console.log('💡 DIAGNOSIS:');
            console.log(`  - You are in ${myGroupIds.size} approval groups`);
            console.log(`  - Found ${allRequests.length} total pending requests in PCO`);
            console.log(`  - ${myGroupRequests.length} are for your groups`);
            console.log(`  - After filtering for future events: 0 remain`);
            console.log('');
            console.log('This likely means:');
            console.log('  1. No one has made requests for resources in your groups');
            console.log('  2. All requests have already been approved/rejected');
            console.log('  3. All pending requests are for past events');
        }

        // STEP 8: Clear and recreate database records
        console.log('📝 STEP 8: Updating database...');
        const existingApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
            user_email: currentUser.email
        }).catch(() => []);

        console.log(`🗑️ Deleting ${A(existingApprovals).length} existing approvals`);

        for (const existing of A(existingApprovals)) {
            try {
                await base44.asServiceRole.entities.PendingApproval.delete(existing.id);
            } catch (error) {
                console.error('Error deleting approval:', error);
            }
        }

        console.log(`💾 Creating ${myApprovals.length} new approvals`);

        for (const approval of myApprovals) {
            try {
                await base44.asServiceRole.entities.PendingApproval.create(approval);
            } catch (error) {
                console.error('Error creating approval:', error);
            }
        }

        console.log('✅ Sync complete!');
        console.log('========================================');

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
        console.error('========================================');
        console.error('❌ FATAL ERROR in syncMyApprovals');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('========================================');
        return Response.json({ 
            error: error.message,
            pending_approvals: [],
            count: 0
        }, { status: 500 });
    }
});