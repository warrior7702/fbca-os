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
    const { resourceRequestId, action = 'approve' } = body;
    console.log('📋 resourceRequestId:', resourceRequestId, 'action:', action);

    // Validate required field
    if (!resourceRequestId) {
      console.log('❌ Missing resourceRequestId');
      return Response.json(
        { error: 'Missing resourceRequestId' },
        { status: 400 }
      );
    }

    // Get user's PCO token
    console.log('🔐 Fetching user record from Base44...');
    const userRecord = await base44.asServiceRole.entities.User.get(user.id);
    console.log('✅ User record fetched, has pco_access_token:', !!userRecord?.pco_access_token);
    
    if (!userRecord?.pco_access_token) {
      console.log('❌ No PCO access token found');
      return Response.json(
        { error: 'Please reconnect Planning Center in Settings' },
        { status: 403 }
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

    // Get event_id and resource_id from request body (needed for resource_bookings endpoint)
    const { eventId, resourceId } = body;
    console.log('📋 eventId:', eventId, 'resourceId:', resourceId);

    if (!eventId || !resourceId) {
      console.log('❌ Missing eventId or resourceId');
      return Response.json(
        { error: 'Missing eventId or resourceId' },
        { status: 400 }
      );
    }

    // Map action to PCO approval_status
    const approvalStatus = action === 'deny' ? 'R' : 'A';
    console.log('📊 Mapped action to approval_status:', approvalStatus);

    // Send PATCH request to PCO event_resource_requests endpoint
    const pcoUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests/${resourceRequestId}`;
    console.log('📤 Sending PATCH to PCO:', pcoUrl);
    
    const response = await fetch(pcoUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userRecord.pco_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          type: 'EventResourceRequest',
          id: resourceRequestId.toString(),
          attributes: {
            approval_status: approvalStatus
          }
        }
      })
    });

    console.log('📬 PCO response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('❌ PCO error response:', errorBody);
      
      // Parse PCO error for better messaging
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
      
      return Response.json(
        {
          error: userMessage,
          detail: errorDetail,
          status: response.status
        },
        { status: response.status }
      );
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