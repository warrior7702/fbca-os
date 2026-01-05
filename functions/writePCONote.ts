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

    const { event_id, badge_code, access_time } = body;

    if (!event_id) {
      console.error('❌ Missing event_id');
      return Response.json({ error: 'event_id required' }, { status: 400 });
    }
    if (!badge_code) {
      console.error('❌ Missing badge_code');
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    // Clean and format the badge code
    let formattedCode = String(badge_code).trim();
    console.log('🔢 Original code:', badge_code);
    
    // Check if it's "unlock" keyword (case-insensitive)
    const isUnlock = formattedCode.toLowerCase() === 'unlock';
    
    if (isUnlock) {
      // Keep "Unlock" with capital U, no # needed
      formattedCode = 'Unlock';
      console.log('🔓 Detected unlock keyword - formatting as "Unlock"');
    } else {
      // It's a numeric code - validate and add #
      formattedCode = formattedCode.replace(/#/g, ''); // Remove any existing #
      console.log('🔢 Cleaned code:', formattedCode);
      
      if (!/^\d{6}$/.test(formattedCode)) {
        console.error('❌ Invalid code format:', formattedCode);
        return Response.json({ 
          error: 'Invalid door code format. Must be 6 digits or "unlock".' 
        }, { status: 400 });
      }
      
      formattedCode = formattedCode + '#'; // Add # at the end for numeric codes
      console.log('✅ Formatted numeric code:', formattedCode);
    }

    // Get user's PCO OAuth token from database
    console.log('🔍 Fetching user token from database...');
    const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = users[0];

    if (!userRecord?.pco_access_token) {
      console.error('❌ No PCO token found for user');
      return Response.json({
        ok: false,
        error: 'No PCO token. Please reconnect PCO in Settings.'
      }, { status: 401 });
    }

    const token = userRecord.pco_access_token;
    console.log('✅ Using user OAuth token');
    console.log('📊 Token last 10 chars:', token.slice(-10));

    console.log('💬 Posting door code to event activity thread');
    console.log('📅 Event ID:', event_id);
    console.log('🚪 Door Code:', formattedCode);

    // Create comment text for activity thread
    let commentText = `🚪 Building Access Approved\n\n`;
    if (access_time) {
      commentText += `Access Time: ${access_time}\n`;
    }
    commentText += `Door Code: ${formattedCode}`;

    // Use Bearer token (user's OAuth token)
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
        'Authorization': `Bearer ${token}`,
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

    // Save event code locally after sending to PCO
    try {
      const existing = await base44.asServiceRole.entities.LocalEventCode.filter({
        event_id: String(event_id)
      });
      
      if (existing.length === 0) {
        await base44.asServiceRole.entities.LocalEventCode.create({
          event_id: String(event_id),
          event_name: '',
          event_date: new Date().toISOString(),
          access_time: access_time || '',
          door_code: formattedCode
        });
        console.log('✅ LocalEventCode created for event:', event_id);
      } else {
        await base44.asServiceRole.entities.LocalEventCode.update(existing[0].id, {
          door_code: formattedCode,
          access_time: access_time || existing[0].access_time
        });
        console.log('✅ LocalEventCode updated for event:', event_id);
      }
    } catch (err) {
      console.error('⚠️ Failed to save LocalEventCode:', err);
    }

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