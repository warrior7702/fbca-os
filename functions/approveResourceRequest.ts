import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceRequestId, action = 'approve' } = await req.json();

    // Validate required field
    if (!resourceRequestId) {
      return Response.json(
        { error: 'Missing resourceRequestId' },
        { status: 400 }
      );
    }

    // Get user's PCO token
    const userRecord = await base44.asServiceRole.entities.User.get(user.id);
    
    if (!userRecord?.pco_access_token) {
      return Response.json(
        { error: 'Please reconnect Planning Center in Settings' },
        { status: 403 }
      );
    }

    // Map action to PCO approval_status
    const approvalStatus = action === 'deny' ? 'R' : 'A';

    // Send PATCH request to PCO
    const response = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${resourceRequestId}`,
      {
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
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return Response.json(
        {
          error: `PCO API error: ${response.status}`,
          detail: errorBody
        },
        { status: response.status }
      );
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('approveResourceRequest error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});