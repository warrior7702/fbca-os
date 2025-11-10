import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id, event_id, badge_code, append } = await req.json();

    if (!event_id) {
      return Response.json({ error: 'event_id required' }, { status: 400 });
    }
    if (!badge_code) {
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    // Format badge code - support both numeric codes and special codes like "Unlock"
    let formattedCode = String(badge_code).trim();
    
    // If it's a 6-digit numeric code, format it with #
    if (/^\d{6}$/.test(formattedCode)) {
      formattedCode = formattedCode + '#';
    }
    // For non-numeric codes (like "Unlock"), keep as-is
    // Just ensure it's not empty
    else if (formattedCode.length === 0) {
      return Response.json({ 
        error: 'Invalid door code format. Code cannot be empty.' 
      }, { status: 400 });
    }

    // Get PCO Admin credentials (Personal Access Token)
    const appId = Deno.env.get('PCO_APP_ID2');
    const secret = Deno.env.get('PCO_SECRET2');

    if (!appId || !secret) {
      return Response.json({
        ok: false,
        error: 'PCO admin credentials not configured. Please set PCO_APP_ID2 and PCO_SECRET2 in environment variables.'
      }, { status: 500 });
    }

    console.log('💬 Posting door code to event activity thread');
    console.log('Event ID:', event_id);
    console.log('Formatted Door Code:', formattedCode);

    // Create comment text for activity thread - PCO shows who posted it
    const commentText = `🚪 Building Access Approved\n\nDoor Code: ${formattedCode}`;

    // Use Basic Auth with admin credentials - POST a comment to event activity
    const auth = btoa(`${appId}:${secret}`);

    const response = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/events/${event_id}/event_comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: {
            type: 'EventComment',
            attributes: {
              body: commentText
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
        error: 'Failed to post comment to event activity',
        status: response.status,
        details: errorData
      }, { status: response.status });
    }

    const result = responseText ? JSON.parse(responseText) : { success: true };

    return Response.json({
      ok: true,
      event_id,
      comment: commentText,
      comment_id: result?.data?.id,
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