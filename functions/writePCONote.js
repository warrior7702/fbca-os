import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.pco_access_token) {
      return Response.json({ 
        error: 'PCO not connected. Please connect in Settings.' 
      }, { status: 401 });
    }

    const { request_id, badge_code, append } = await req.json();

    if (!request_id) {
      return Response.json({ error: 'request_id required' }, { status: 400 });
    }
    if (!badge_code) {
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    console.log('📝 Writing badge code to request notes using user token');
    console.log('Request ID:', request_id);
    console.log('Badge Code:', badge_code);
    console.log('Append mode:', append);

    // Create note text
    const noteText = `Door Code: ${badge_code} — Approved by ${user.full_name || user.email}`;

    // Optional: append mode (pull existing notes first)
    let finalNote = noteText;
    if (append) {
      const getResp = await fetch(
        `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
        {
          headers: {
            'Authorization': `Bearer ${user.pco_access_token}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (getResp.ok) {
        const current = await getResp.json();
        const existing = current?.data?.attributes?.notes || '';
        finalNote = existing ? `${existing}\n${noteText}` : noteText;
        console.log('📝 Appending to existing notes');
      }
    }

    // Use Bearer token (user's access token)
    const response = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user.pco_access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: {
            type: 'EventResourceRequest',
            id: request_id,
            attributes: {
              notes: finalNote
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
      note: finalNote,
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