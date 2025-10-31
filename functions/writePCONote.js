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

    // Call Vercel endpoint to write note
    const vercelUrl = 'https://pco-webhook.vercel.app';
    const response = await fetch(`${vercelUrl}/api/pco-write-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.pco_access_token}`
      },
      body: JSON.stringify({ request_id, note })
    });

    const result = await response.json();

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: result.error || 'Failed to write note',
        details: result
      }, { status: response.status });
    }

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