import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshTokenIfNeeded(base44: any, user: any): Promise<string> {
  const expiresAt = new Date(user.pco_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return user.pco_access_token;
  }

  console.log('🔄 Refreshing PCO token...');
  const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.pco_refresh_token,
      client_id: Deno.env.get('PCO_CLIENT_ID') || '',
      client_secret: Deno.env.get('PCO_CLIENT_SECRET') || ''
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed');
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

  await base44.asServiceRole.entities.User.update(user.id, {
    pco_access_token: tokens.access_token,
    pco_refresh_token: tokens.refresh_token,
    pco_token_expires_at: newExpiresAt
  });

  console.log('✅ PCO token refreshed');
  return tokens.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user record with tokens
    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, user);

    // Get user's approval groups
    const groupsResponse = await base44.functions.invoke("getUserGroups", {});
    const userGroups = groupsResponse?.data?.approvalGroupNames || [];

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

    // Step 1: Get all approval groups and map which ones the user belongs to
    const allGroupsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!allGroupsResponse.ok) {
      throw new Error(`Failed to fetch approval groups: ${allGroupsResponse.status}`);
    }

    const allGroupsData = await allGroupsResponse.json();
    const userGroupIds = new Set<string>();

    // Find group IDs that match user's group names
    for (const group of allGroupsData.data || []) {
      if (userGroups.includes(group.attributes?.name)) {
        userGroupIds.add(group.id);
      }
    }

    console.log(`📋 User belongs to ${userGroupIds.size} approval group IDs`);

    // Step 2: Build resource-to-group mapping
    const resourceToGroup: Record<string, { groupId: string; groupName: string }> = {};

    for (const group of allGroupsData.data || []) {
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

    console.log(`🗺️ Mapped ${Object.keys(resourceToGroup).length} resources to groups`);

    // Step 3: Fetch ALL pending resource requests using the direct endpoint
    // PCO uses 'P' for pending status, not 'pending'
    const requestsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!requestsResponse.ok) {
      throw new Error(`Failed to fetch pending requests: ${requestsResponse.status}`);
    }

    const requestsData = await requestsResponse.json();
    console.log(`📊 Total pending requests from PCO: ${requestsData.data?.length || 0}`);

    // Build lookup maps for included data
    const eventsMap: Record<string, any> = {};
    const resourcesMap: Record<string, any> = {};

    for (const included of requestsData.included || []) {
      if (included.type === 'Event') {
        eventsMap[included.id] = included;
      } else if (included.type === 'Resource') {
        resourcesMap[included.id] = included;
      }
    }

    // Step 4: Filter requests to only those in user's groups
    const allApprovals = [];

    for (const request of requestsData.data || []) {
      const resourceId = request.relationships?.resource?.data?.id;
      const eventId = request.relationships?.event?.data?.id;
      const groupInfo = resourceToGroup[resourceId];

      // Check if this resource belongs to one of user's groups
      const isUserGroup = groupInfo && userGroupIds.has(groupInfo.groupId);

      if (isUserGroup) {
        const event = eventsMap[eventId];
        const resource = resourcesMap[resourceId];

        allApprovals.push({
          resourceRequestId: request.id,
          eventId: eventId,
          eventName: event?.attributes?.name || 'Unknown Event',
          eventStartsAt: event?.attributes?.starts_at,
          eventEndsAt: event?.attributes?.ends_at,
          resourceId: resourceId,
          resourceName: resource?.attributes?.name || 'Unknown Resource',
          approvalGroups: [{ id: groupInfo.groupId, name: groupInfo.groupName }],
          quantity: request.attributes?.quantity || 1,
          type: resource?.attributes?.kind || 'resource',
          status: request.attributes?.approval_status
        });
      }
    }

    // Sort by event start date
    allApprovals.sort((a, b) => {
      const dateA = a.eventStartsAt ? new Date(a.eventStartsAt).getTime() : 0;
      const dateB = b.eventStartsAt ? new Date(b.eventStartsAt).getTime() : 0;
      return dateA - dateB;
    });

    console.log(`✅ Total pending approvals for user: ${allApprovals.length}`);

    // Build debug info to help diagnose issues (v2)
    const debug = {
      userGroups,
      userGroupIds: Array.from(userGroupIds),
      allGroupsFromPCO: (allGroupsData.data || []).map((g: any) => ({ id: g.id, name: g.attributes?.name })),
      resourceToGroupCount: Object.keys(resourceToGroup).length,
      totalPendingInPCO: requestsData.data?.length || 0,
      // Show first few pending requests for debugging
      samplePendingRequests: (requestsData.data || []).slice(0, 5).map((r: any) => ({
        id: r.id,
        resourceId: r.relationships?.resource?.data?.id,
        eventId: r.relationships?.event?.data?.id,
        status: r.attributes?.approval_status,
        mappedGroup: resourceToGroup[r.relationships?.resource?.data?.id] || null
      }))
    };

    return Response.json({
      success: true,
      totalEvents: Object.keys(eventsMap).length,
      totalApprovals: allApprovals.length,
      approvals: allApprovals,
      debug
    });

  } catch (error) {
    console.error('❌ Error fetching approvals:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 200 });
  }
});