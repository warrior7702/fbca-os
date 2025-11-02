import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id, note } = await req.json();

    if (!request_id) {
      return Response.json({ error: 'request_id required' }, { status: 400 });
    }
    if (!note) {
      return Response.json({ error: 'note required' }, { status: 400 });
    }

    // Get user's PCO token
    if (!user.pco_access_token) {
      return Response.json({ 
        error: 'PCO not connected' 
      }, { status: 401 });
    }

    console.log('📝 Writing note to request:', request_id);
    console.log('🔑 Using token for user:', user.email);

    // Write note directly to PCO API (no Vercel proxy)
    const pcoUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/notes`;
    
    const response = await fetch(pcoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.pco_access_token}`
      },
      body: JSON.stringify({
        data: {
          type: 'Note',
          attributes: {
            note: note
          }
        }
      })
    });

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
        error: 'PCO note write failed',
        status: response.status,
        details: errorData
      }, { status: response.status });
    }

    const result = responseText ? JSON.parse(responseText) : { success: true };

    return Response.json({
      ok: true,
      request_id,
      note,
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