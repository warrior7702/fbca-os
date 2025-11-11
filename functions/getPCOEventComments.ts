import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event_id } = body;

    if (!event_id) {
      return Response.json({ error: 'event_id required' }, { status: 400 });
    }

    // Get user's PCO token
    const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = users[0];

    if (!userRecord?.pco_access_token) {
      return Response.json({
        ok: false,
        error: 'No PCO token. Please reconnect PCO in Settings.'
      }, { status: 401 });
    }

    const token = userRecord.pco_access_token;

    // Fetch event comments
    const url = `https://api.planningcenteronline.com/calendar/v2/events/${event_id}/event_comments?per_page=100`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({
        ok: false,
        error: 'Failed to fetch comments',
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    const comments = data.data || [];

    // Extract door codes from comments
    const doorCodes = [];
    const doorCodePattern = /Door Code:\s*(\w+)/i;
    
    for (const comment of comments) {
      const body = comment.attributes?.body || '';
      const match = body.match(doorCodePattern);
      if (match) {
        doorCodes.push({
          code: match[1],
          created_at: comment.attributes?.created_at,
          is_unlock: match[1].toLowerCase() === 'unlock'
        });
      }
    }

    return Response.json({
      ok: true,
      comments: comments.map(c => ({
        id: c.id,
        body: c.attributes?.body,
        created_at: c.attributes?.created_at
      })),
      door_codes: doorCodes
    });

  } catch (error) {
    console.error('❌ getPCOEventComments error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});