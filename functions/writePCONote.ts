import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      console.error('❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Authenticated user:', user.email);

    const body = await req.json();
    console.log('📦 Request body:', JSON.stringify(body, null, 2));

    const { event_id, badge_code } = body;

    if (!event_id) {
      console.error('❌ Missing event_id');
      return Response.json({ error: 'event_id required' }, { status: 400 });
    }
    if (!badge_code) {
      console.error('❌ Missing badge_code');
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    // Format badge code to ensure format is xxxxxx# (6 digits + #)
    let formattedCode = String(badge_code).replace(/#/g, '').trim(); // Remove any existing #
    console.log('🔢 Original code:', badge_code);
    console.log('🔢 Cleaned code:', formattedCode);

    if (!/^\d{6}$/.test(formattedCode)) {
      console.error('❌ Invalid code format:', formattedCode);
      return Response.json({ 
        error: 'Invalid door code format. Must be 6 digits.' 
      }, { status: 400 });
    }
    formattedCode = formattedCode + '#'; // Add # at the end
    console.log('✅ Formatted code:', formattedCode);

    // Get PCO Admin credentials (Personal Access Token)
    const appId = Deno.env.get('PCO_APP_ID2');
    const secret = Deno.env.get('PCO_SECRET2');

    console.log('🔑 PCO_APP_ID2 exists:', !!appId);
    console.log('🔑 PCO_SECRET2 exists:', !!secret);

    if (!appId || !secret) {
      console.error('❌ Missing PCO admin credentials');
      return Response.json({
        ok: false,
        error: 'PCO admin credentials not configured. Please set PCO_APP_ID2 and PCO_SECRET2 in environment variables.'
      }, { status: 500 });
    }

    console.log('💬 Posting door code to event activity thread');
    console.log('📅 Event ID:', event_id);
    console.log('🚪 Door Code:', formattedCode);

    // Create comment text for activity thread - PCO shows who posted it
    const commentText = `🚪 Building Access Approved\n\nDoor Code: ${formattedCode}`;

    // Use Basic Auth with admin credentials - POST a comment to event activity
    const auth = btoa(`${appId}:${secret}`);
    const url = `https://api.planningcenteronline.com/calendar/v2/events/${event_id}/event_comments`;
    
    console.log('🔗 POST URL:', url);

    const requestBody = {
      data: {
        type: 'EventComment',
        attributes: {
          body: commentText
        }
      }
    };
    
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('📥 PCO Response Status:', response.status);
    console.log('📥 PCO Response:', responseText);

    if (!response.ok) {
      console.error('❌ PCO API Error:', responseText);
      
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

    console.log('✅ Successfully posted door code to PCO');

    const result = responseText ? JSON.parse(responseText) : { success: true };

    return Response.json({
      ok: true,
      event_id,
      comment: commentText,
      comment_id: result?.data?.id,
      result
    });

  } catch (error) {
    console.error('❌ writePCONote error:', error);
    console.error('Stack:', error.stack);
    return Response.json({ 
      ok: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});