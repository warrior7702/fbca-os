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

    // Handle "Unlock" special case (no code needed)
    const badgeCodeStr = String(badge_code).trim();
    let formattedCode;
    
    if (badgeCodeStr.toLowerCase() === 'unlock') {
      formattedCode = 'Unlock (No code needed)';
    } else {
      // Format badge code to ensure format is xxxxxx# (6 digits + #)
      formattedCode = badgeCodeStr.replace(/#/g, ''); // Remove any existing #
      if (!/^\d{6}$/.test(formattedCode)) {
        return Response.json({ 
          error: 'Invalid door code format. Must be 6 digits or "Unlock".' 
        }, { status: 400 });
      }
      formattedCode = formattedCode + '#'; // Add # at the end
    }

    // Get PCO credentials (using main OAuth app)
    const clientId = Deno.env.get('PCO_CLIENT_ID');
    const clientSecret = Deno.env.get('PCO_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.json({
        ok: false,
        error: 'PCO credentials not configured. Please set PCO_CLIENT_ID and PCO_CLIENT_SECRET in environment variables.'
      }, { status: 500 });
    }

    console.log('💬 Posting door code to event activity thread');
    console.log('Event ID:', event_id);
    console.log('Formatted Door Code:', formattedCode);

    // Create comment text for activity thread - PCO shows who posted it
    const commentText = `🚪 Building Access Approved\n\nDoor Code: ${formattedCode}`;

    // Use Basic Auth with PCO credentials - POST a comment to event activity
    const auth = btoa(`${clientId}:${clientSecret}`);

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