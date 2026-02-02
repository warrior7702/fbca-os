import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshTokenIfNeeded(base44, user) {
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

    console.log(`🔍 Current user: ${currentUser.email} (ID: ${currentUser.id})`);

    // Get full user record with tokens - use ID not email to avoid duplicates
    const user = await base44.asServiceRole.entities.User.get(currentUser.id);

    console.log(`📝 Fetched user record: ${user.email} (ID: ${user.id})`);
    console.log(`🔑 PCO user_id stored: ${user.pco_user_id}`);
    console.log(`🔑 PCO token last 10 chars: ${user.pco_access_token?.slice(-10)}`);

    if (!user || !user.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 400 });
    }

    const { resourceRequestId, action = 'approve' } = await req.json();
    
    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(base44, user);
    console.log(`🔐 Using token (last 10): ${accessToken.slice(-10)}`);

    // Verify token ownership
    const meCheck = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (meCheck.ok) {
      const meData = await meCheck.json();
      console.log(`✅ Token belongs to: ${meData.data?.attributes?.name} (PCO ID: ${meData.data?.id})`);
    }

    if (!resourceRequestId) {
      return Response.json({ error: 'resourceRequestId required' }, { status: 400 });
    }

    // Map action to PCO approval_status
    const approvalStatus = action === 'deny' ? 'R' : 'A';

    console.log(`${action === 'deny' ? 'Denying' : 'Approving'} resource request ${resourceRequestId}`);

    // Approve/Deny the resource request via PCO API
    const response = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${resourceRequestId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            type: 'EventResourceRequest',
            id: resourceRequestId,
            attributes: {
              approval_status: approvalStatus
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ PCO API error:', response.status, errorText);
      
      let errorMessage = 'PCO API error';
      if (response.status === 403) {
        errorMessage = 'Permission denied - you may not have access to approve this resource';
      } else if (response.status === 401) {
        errorMessage = 'PCO authentication failed - try reconnecting in Settings';
      }
      
      return Response.json({ 
        success: false, 
        error: errorMessage,
        details: errorText,
        status: response.status
      }, { status: response.status });
    }

    const result = await response.json();

    return Response.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('Approve error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});