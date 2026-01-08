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

    const { days_ahead = 21 } = await req.json().catch(() => ({}));

    // Get user with PCO token
    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = A(users)[0];

    if (!user || !user.pco_access_token) {
      return Response.json({ 
        error: 'PCO not connected'
      }, { status: 400 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, user);

    // Define target approval groups
    const TARGET_GROUPS = ['Room Setups', 'Maintenance'];

    // STEP 1: Get approval groups
    console.log('📝 Fetching approval groups...');
    const groupsResponse = await fetchPCO(
      base44,
      '/calendar/v2/resource_approval_groups?per_page=100',
      accessToken
    );

    if (!groupsResponse.ok) {
      throw new Error('Failed to fetch approval groups');
    }

    const groupsData = await groupsResponse.json();
    const allGroups = A(groupsData.data);
    
    const targetGroupMap = {};
    allGroups.forEach(group => {
      const groupName = group.attributes?.name;
      if (TARGET_GROUPS.includes(groupName)) {
        targetGroupMap[group.id] = groupName;
      }
    });

    console.log(`✅ Found ${Object.keys(targetGroupMap).length} target approval groups`);

    // STEP 2: Map resources to target groups
    const resourceToGroupMap = {};
    for (const groupId of Object.keys(targetGroupMap)) {
      await delay(100);
      
      const resourcesResponse = await fetchPCO(
        base44,
        `/calendar/v2/resource_approval_groups/${groupId}/resources?per_page=100`,
        accessToken
      );

      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json();
        const resources = A(resourcesData.data);
        
        for (const resource of resources) {
          resourceToGroupMap[resource.id] = {
            groupId: groupId,
            groupName: targetGroupMap[groupId],
            resourceName: resource.attributes?.name,
            isBookable: resource.attributes?.bookable !== false // Default to true
          };
        }
      }
    }

    console.log(`✅ Mapped ${Object.keys(resourceToGroupMap).length} resources`);

    // STEP 3: Fetch upcoming event instances
    console.log('📝 Fetching upcoming event instances...');
    const now = new Date();
    const futureDate = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);
    
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
        const startsAt = new Date(instance.attributes?.starts_at);
        
        // Only include instances within our window
        if (startsAt <= futureDate) {
          const eventId = instance.relationships?.event?.data?.id;
          if (eventId) {
            eventInstanceMap[eventId] = {
              instanceId: instance.id,
              starts_at: instance.attributes?.starts_at,
              ends_at: instance.attributes?.ends_at
            };
          }
        }
      }
      
      instanceNextUrl = instancesData.links?.next || null;
      instancePageCount++;
    }

    console.log(`✅ Found ${Object.keys(eventInstanceMap).length} future event instances`);

    // STEP 4: Fetch pending approval requests
    console.log('📝 Fetching pending resource requests...');
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

    console.log(`✅ Fetched ${allRequests.length} pending requests`);

    // STEP 5: Filter to target groups and build normalized events
    const eventsWithApprovals = {};

    for (const request of allRequests) {
      const resourceId = request.relationships?.resource?.data?.id;
      const eventId = request.relationships?.event?.data?.id;
      
      const groupInfo = resourceToGroupMap[resourceId];
      if (!groupInfo) continue; // Not in target groups
      
      const eventInstance = eventInstanceMap[eventId];
      if (!eventInstance) continue; // Past event or outside window
      
      const event = eventMap[eventId];
      const resource = resourceMap[resourceId];
      
      // Initialize event if not exists
      if (!eventsWithApprovals[eventId]) {
        eventsWithApprovals[eventId] = {
          pco_event_id: eventId,
          title: event?.attributes?.name || 'Unknown Event',
          starts_at: eventInstance.starts_at,
          ends_at: eventInstance.ends_at,
          status: 'active',
          rooms: [],
          approvals: [],
          raw: event
        };
      }

      // Add room if bookable and not duplicate
      if (groupInfo.isBookable && resource?.attributes?.kind === 'Room') {
        const roomAlreadyAdded = eventsWithApprovals[eventId].rooms.some(r => 
          r.pco_room_id === resourceId
        );
        
        if (!roomAlreadyAdded) {
          eventsWithApprovals[eventId].rooms.push({
            pco_room_id: resourceId,
            room_name: resource.attributes?.name || 'Unknown Room',
            is_bookable: true
          });
        }
      }

      // Fetch answers for this request
      let answers = {};
      try {
        await delay(100);
        const answersResponse = await fetchPCO(
          base44,
          `/calendar/v2/event_resource_requests/${request.id}/answers`,
          accessToken
        );
        
        if (answersResponse.ok) {
          const answersData = await answersResponse.json();
          const answersList = A(answersData.data);
          
          for (const answer of answersList) {
            const question = answer.attributes?.question_label || 'Question';
            const value = answer.attributes?.value || answer.attributes?.text || '';
            answers[question] = value;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch answers for request ${request.id}`);
      }

      // Add approval
      eventsWithApprovals[eventId].approvals.push({
        approval_group: groupInfo.groupName,
        requested_resources: {
          resource_id: resourceId,
          resource_name: resource?.attributes?.name || 'Unknown',
          quantity: request.attributes?.quantity || 1
        },
        answers: answers,
        submitted_at: request.attributes?.created_at,
        approval_status: 'pending'
      });
    }

    const normalizedEvents = Object.values(eventsWithApprovals);
    
    console.log(`✅ Normalized ${normalizedEvents.length} events with approvals`);

    return Response.json({
      success: true,
      events: normalizedEvents,
      count: normalizedEvents.length
    });

  } catch (error) {
    console.error('Error fetching upcoming approval events:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});