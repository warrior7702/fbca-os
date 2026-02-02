import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 400 });
    }

    const { resourceRequestId, action = 'approve' } = await req.json();

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
          'Authorization': `Bearer ${user.pco_access_token}`,
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
      return Response.json({ 
        success: false, 
        error: 'PCO API error',
        details: errorText 
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