import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const refreshTokenIfNeeded = async (base44, user) => {
  const expiresAt = new Date(user.pco_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return user.pco_access_token;
  }

  console.log('🔄 Token expiring soon, refreshing...');
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

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    console.error('Token refresh failed:', err);
    throw new Error('Token refresh failed');
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

  await base44.asServiceRole.entities.User.update(user.id, {
    pco_access_token: tokens.access_token,
    pco_refresh_token: tokens.refresh_token,
    pco_token_expires_at: newExpiresAt
  });

  console.log('✅ Token refreshed successfully');
  return tokens.access_token;
};

Deno.serve(async (req) => {
  try {
    console.log('🔍 approveResourceRequest started');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('👤 User:', user?.email);

    if (!user) {
      console.log('❌ No user found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📦 Request body:', body);

    // Support both legacy and new parameter names
    let resourceRequestId = undefined;
    let eventId = undefined;
    let resourceId = undefined;
    let action = 'approve';

    if (typeof body === 'object' && body !== null) {
      resourceRequestId = String(body.resourceRequestId ?? body.request_id ?? '').trim();
      eventId = String(body.eventId ?? body.event_id ?? '').trim();
      resourceId = String(body.resourceId ?? body.resource_id ?? '').trim();
      action = String(body.action ?? 'approve').trim().toLowerCase();
    }

    console.log('📋 Parsed resourceRequestId:', resourceRequestId, 'eventId:', eventId, 'resourceId:', resourceId, 'action:', action);

    // Validate required fields
    if (!resourceRequestId || !['approve','deny'].includes(action)) {
      console.log('❌ Missing resourceRequestId or invalid action');
      return Response.json(
        { error: 'resourceRequestId (or request_id) and action=approve|deny required' },
        { status: 400 }
      );
    }

    // Fetch user record with pco tokens
    console.log('🔐 Fetching user record from Base44...');
    const userRecord = await base44.asServiceRole.entities.User.get(user.id);
    console.log('✅ User record fetched, has pco_access_token:', !!userRecord?.pco_access_token);

    if (!userRecord?.pco_access_token) {
      console.log('❌ No PCO access token found');
      return Response.json(
        { error: 'Please reconnect Planning Center in Settings' },
        { status: 401 }
      );
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(base44, userRecord);
    console.log('✅ Token ready (fresh or valid)');

    // Verify token by calling PCO /me endpoint
    console.log('🔍 Verifying PCO token...');
    const meResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/me',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    const meData = await meResponse.json();
    console.log('📋 PCO /me response:', JSON.stringify(meData));

    if (!meResponse.ok) {
      console.log('❌ Token verification failed');
      return Response.json(
        {
          error: 'Planning Center token is invalid or expired. Please reconnect.',
          detail: meData
        },
        { status: 403 }
      );
    }

    const pcoUserId = meData.data?.id;

    // If eventId or resourceId missing, fetch details from PCO to obtain them
    if (!eventId || !resourceId) {
      try {
        console.log('📦 Missing eventId or resourceId, fetching request details from PCO...');
        const detailsRes = await fetch(
          `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${resourceRequestId}?include=resource,event`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const detailsData = await detailsRes.json();
        eventId = eventId || detailsData.data?.relationships?.event?.data?.id;
        resourceId = resourceId || detailsData.data?.relationships?.resource?.data?.id;
        console.log('📝 Fetched eventId:', eventId, 'resourceId:', resourceId);
      } catch (e) {
        console.log('⚠️ Failed to fetch request details:', e);
      }
    }

    // Validate again after attempt
    if (!eventId || !resourceId) {
      console.log('❌ Still missing eventId or resourceId');
      return Response.json(
        { error: 'eventId and resourceId are required to approve or deny this request' },
        { status: 400 }
      );
    }

    // Check if user has permission via approval groups
    try {
      console.log('📦 Checking approval groups and resource permissions...');
      // Get all resource approval groups
      const groupsRes = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const groupsData = await groupsRes.json();
      const myGroupIds = [];
      const groupResourceMap = {};

      for (const group of groupsData.data || []) {
        // Fetch group members
        const membersRes = await fetch(
          `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          const isMember = (membersData.data || []).some((person) => person.id === pcoUserId);
          if (isMember) {
            myGroupIds.push(group.id);
            console.log('✅ Member of group:', group.attributes?.name, '(', group.id, ')');
            // Fetch resources for this group
            const resourcesRes = await fetch(
              `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            if (resourcesRes.ok) {
              const resourcesData = await resourcesRes.json();
              groupResourceMap[group.id] = (resourcesData.data || []).map((r) => r.id);
              console.log('  ↳ Manages', groupResourceMap[group.id].length, 'resources');
            }
          }
        }
      }

      // Determine if any of the user's groups manage this resource
      let hasPermission = false;
      for (const groupId of myGroupIds) {
        const resources = groupResourceMap[groupId] || [];
        if (resources.includes(resourceId)) {
          hasPermission = true;
          console.log('✅ Group', groupId, 'manages this resource');
          break;
        }
      }

      if (!hasPermission) {
        console.log('❌ User does not have permission to approve this resource');
        return Response.json(
          {
            error: 'You do not have permission to approve this request. Verify you belong to the correct approval group.',
            status: 403
          },
          { status: 403 }
        );
      }
    } catch (e) {
      console.log('⚠️ Error while checking approval groups:', e);
    }

    // Try POST to nested action endpoint under event
    const actionPath = action === 'deny' ? 'deny' : 'approve';
    console.log('📊 Using action:', actionPath);

    // Try: /events/{eventId}/event_resource_requests/{id}/approve
    const pcoUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests/${resourceRequestId}/${actionPath}`;
    console.log('📤 Sending POST to PCO (nested action endpoint):', pcoUrl);

    const response = await fetch(pcoUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log('📬 PCO response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('❌ PCO error response:', errorBody);
      let errorDetail = errorBody;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.errors?.[0]?.detail) {
          errorDetail = errorJson.errors[0].detail;
        }
      } catch {}
      const userMessage = response.status === 403
        ? 'You do not have permission to approve this request in Planning Center. Verify you are in the correct approval group.'
        : `PCO API error: ${response.status}`;
      return Response.json({ error: userMessage, detail: errorDetail, status: response.status }, { status: response.status });
    }

    console.log('✅ Success!');
    return Response.json({ success: true });

  } catch (error) {
    console.error('approveResourceRequest error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});