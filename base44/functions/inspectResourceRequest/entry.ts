import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshTokenIfNeeded(base44, user) {
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
}

Deno.serve(async (req) => {
  try {
    console.log('🔍 inspectResourceRequest started');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('👤 User:', user?.email);

    if (!user) {
      console.log('❌ No user found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resourceRequestId, eventId } = body;
    console.log('📦 resourceRequestId:', resourceRequestId, 'eventId:', eventId);

    if (!resourceRequestId || !eventId) {
      console.log('❌ Missing resourceRequestId or eventId');
      return Response.json(
        { error: 'Missing resourceRequestId or eventId' },
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
    console.log('✅ Token ready');

    // Step 1: Get the request object itself
    console.log('📋 Step 1: Fetching request object...');
    const requestUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests/${resourceRequestId}`;
    console.log('   URL:', requestUrl);
    
    const requestResponse = await fetch(requestUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const requestData = await requestResponse.json();
    console.log('📋 Request object:', JSON.stringify(requestData, null, 2));

    // Step 2: Try to PATCH it (test the write operation)
    console.log('📦 Step 2: Attempting PATCH to approve (to see which user it uses)...');
    
    const patchBody = JSON.stringify({
      data: {
        type: 'EventResourceRequest',
        id: resourceRequestId.toString(),
        attributes: {
          approval_status: 'A'
        }
      }
    });
    
    console.log('📤 PATCH body:', patchBody);
    
    const patchResponse = await fetch(requestUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: patchBody
    });

    const patchData = await patchResponse.json();
    console.log('📬 PATCH response status:', patchResponse.status);
    console.log('📬 PATCH response body:', JSON.stringify(patchData, null, 2));

    // Return all diagnostics
    return Response.json({
      success: true,
      request_object: requestData.data || null,
      patch_attempt: {
        status: patchResponse.status,
        success: patchResponse.ok,
        response: patchData,
        error_detail: patchData.errors?.[0]?.detail || 'No error',
        error_source: patchData.errors?.[0]?.source || 'Unknown'
      },
      user_performing_patch: user.email,
      calendar_user_id: userRecord.pco_user_id || 'not stored'
    });

  } catch (error) {
    console.error('inspectResourceRequest error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});