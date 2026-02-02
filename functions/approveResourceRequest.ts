import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Verify token by calling PCO /me endpoint
    console.log('🔍 Verifying PCO token...');
    const meResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/me',
      {
        headers: {
          'Authorization': `Bearer ${userRecord.pco_access_token}`
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

    // Map action to PCO approval_status
    const approvalStatus = action === 'deny' ? 'R' : 'A';
    console.log('📊 Mapped action to approval_status:', approvalStatus);

    // Send PATCH request to PCO
    const pcoUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${resourceRequestId}`;
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