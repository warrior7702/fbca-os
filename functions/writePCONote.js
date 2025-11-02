import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id, badge_code } = await req.json();

    if (!request_id) {
      return Response.json({ error: 'request_id required' }, { status: 400 });
    }
    if (!badge_code) {
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    // Get PCO Admin credentials
    const appId = Deno.env.get('PCO_APP_ID2');
    const secret = Deno.env.get('PCO_SECRET2');

    if (!appId || !secret) {
      return Response.json({
        ok: false,
        error: 'PCO admin credentials not configured'
      }, { status: 500 });
    }

    console.log('📝 Writing badge code to request notes using Basic Auth');
    console.log('Request ID:', request_id);
    console.log('Badge Code:', badge_code);

    // Create note text
    const noteText = `Door Code: ${badge_code} — Approved by ${user.full_name || user.email}`;

    // Use Basic Auth with admin token
    const auth = btoa(`${appId}:${secret}`);

    const response = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: {
            type: 'EventResourceRequest',
            id: request_id,
            attributes: {
              notes: noteText
            }
          }
        })
      }
    );

    const responseText = await response.text();
    console.log('📥 PCO Response Status:', response.status);
    console.log('📥 PCO Response:', responseText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { raw: responseText };
      }

      return Response.json({
        ok: false,
        error: 'Failed to write note',
        status: response.status,
        details: errorData
      }, { status: response.status });
    }

    const result = responseText ? JSON.parse(responseText) : { success: true };

    return Response.json({
      ok: true,
      request_id,
      note: noteText,
      result
    });

  } catch (error) {
    console.error('writePCONote error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});