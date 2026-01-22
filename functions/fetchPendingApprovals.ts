import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    const { windowDays = 180, groups = [] } = await req.json().catch(() => ({}));
    const userGroups = Array.isArray(groups) ? groups : [];

    console.log(`👤 User groups: ${userGroups.join(", ")}`);

    if (userGroups.length === 0) {
      return Response.json({
        success: true,
        totalEvents: 0,
        totalApprovals: 0,
        approvals: [],
        message: "User not assigned to any approval groups"
      });
    }

    // Calculate date range
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + windowDays);

    const startStr = today.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    console.log(`📅 Fetching events from ${startStr} to ${endStr}`);

    // Fetch events in the date range
    const eventsUrl = `https://api.planningcenteronline.com/calendar/v2/events?filter=future&per_page=100`;
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
    });

    if (!eventsResponse.ok) {
      throw new Error(`PCO events fetch failed: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    console.log(`📊 Total events fetched: ${eventsData.data?.length || 0}`);

    // For each event, fetch resource requests
    const allApprovals = [];
    
    for (const event of eventsData.data || []) {
      const eventId = event.id;
      const eventName = event.attributes.name;
      const eventStartsAt = event.attributes.starts_at;
      const eventEndsAt = event.attributes.ends_at;

      // Fetch resource requests for this event
      const requestsUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/resource_requests?include=resource,resource.resource_approval_groups&per_page=100`;
      
      const requestsResponse = await fetch(requestsUrl, {
        headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
      });

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        
        // Process each resource request
        for (const request of requestsData.data || []) {
          const status = request.attributes.status;
          
          // Only include pending requests
          if (status === 'pending' || status === 'awaiting_approval') {
            // Find the resource in included data
            const resourceId = request.relationships?.resource?.data?.id;
            const resource = requestsData.included?.find(
              inc => inc.type === 'Resource' && inc.id === resourceId
            );

            // Find approval groups
            const approvalGroupIds = resource?.relationships?.resource_approval_groups?.data?.map(g => g.id) || [];
            const approvalGroups = approvalGroupIds.map(groupId => {
              const group = requestsData.included?.find(
                inc => inc.type === 'ResourceApprovalGroup' && inc.id === groupId
              );
              return {
                id: group?.id,
                name: group?.attributes?.name
              };
            }).filter(g => g.id);

            // Check if any approval group matches user's groups
            const matchesUserGroup = approvalGroups.some(ag => 
              userGroups.includes(ag.name)
            );

            if (matchesUserGroup) {
              allApprovals.push({
                resourceRequestId: request.id,
                eventId: eventId,
                eventName: eventName,
                eventStartsAt: eventStartsAt,
                eventEndsAt: eventEndsAt,
                resourceId: resourceId,
                resourceName: resource?.attributes?.name || 'Unknown',
                approvalGroups: approvalGroups,
                quantity: request.attributes.quantity || 1,
                type: resource?.attributes?.kind || 'resource',
                status: status
              });
            }
          }
        }
      }
    }

    console.log(`✅ Total pending approvals found: ${allApprovals.length}`);

    return Response.json({
      success: true,
      totalEvents: eventsData.data?.length || 0,
      totalApprovals: allApprovals.length,
      approvals: allApprovals,
      windowDays: windowDays
    });

  } catch (error) {
    console.error('❌ Error fetching approvals:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});