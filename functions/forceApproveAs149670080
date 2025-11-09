import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    if (!me) {
      return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Parse payload
    let body = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { body = await req.json(); } catch { body = {}; }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }

    const request_id = String(body.request_id || '').trim();
    const action = String(body.action || 'approve').trim().toLowerCase();

    console.log('🧪 FORCE APPROVE TEST with user ID 149670080');
    console.log('📋 Request ID:', request_id);
    console.log('📋 Action:', action);
    console.log('👤 Current user:', me.email);

    if (!request_id) {
      return Response.json(
        { ok: false, error: 'request_id required' },
        { status: 400 }
      );
    }

    // Get fresh token from DATABASE
    console.log('🔍 Fetching fresh token from database...');
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json(
        { ok: false, error: 'No PCO token. Please reconnect PCO in Settings.' },
        { status: 401 }
      );
    }

    const userToken = user.pco_access_token;
    console.log('✅ Using FRESH token from database');
    console.log('📊 Token last 10 chars:', userToken.slice(-10));

    // FORCE user ID 149670080 in the approval
    const forcedUserId = '149670080';
    const statusCode = action === 'approve' ? 'A' : 'R';
    
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('🧪 FORCING APPROVAL AS USER:', forcedUserId);
    console.log('📝 Request:', request_id);
    console.log('✅ Status:', statusCode);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Build the URL with forced user_id
    const url = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`;
    
    // Build PATCH body
    const patchBody = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: statusCode,
          approved_by_id: forcedUserId  // FORCE this user ID
        }
      }
    };

    console.log('📤 Sending PATCH request...');
    console.log('🔗 URL:', url);
    console.log('📦 Body:', JSON.stringify(patchBody, null, 2));

    // Make the approval request
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchBody)
    });

    const responseText = await response.text();
    
    console.log('');
    console.log('📊 ═══════════════════════════════════════════════════════════');
    console.log('📊 PCO Response Status:', response.status);
    console.log('📊 PCO Response:', responseText);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    if (!response.ok) {
      console.error('❌ PCO Error:', responseText);
      
      // Parse error message
      let errorMsg = 'Permission denied';
      let errorDetails = {};
      
      if (response.status === 403) {
        errorMsg = 'Still getting 403 even with forced user ID 149670080';
        
        // Check if it still mentions 3566727
        if (responseText.includes('3566727')) {
          errorDetails.still_using_old_user = true;
          errorDetails.message = '❌ PCO STILL references user 3566727 even though we forced 149670080!';
        } else if (responseText.includes('149670080')) {
          errorDetails.using_new_user = true;
          errorDetails.message = '✅ PCO is using user 149670080, but still denied - permission issue';
        }
      } else if (response.status === 404) {
        errorMsg = 'Request not found';
      } else {
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.errors?.[0]?.detail || responseText;
        } catch {
          errorMsg = responseText;
        }
      }
      
      return Response.json({
        ok: false,
        error: errorMsg,
        status: response.status,
        details: responseText,
        forced_user_id: forcedUserId,
        analysis: errorDetails
      }, { status: response.status });
    }

    console.log('✅ SUCCESS!');
    console.log('🎉 Approval worked with forced user ID 149670080!');
    
    const result = responseText ? JSON.parse(responseText) : { ok: true };
    
    return Response.json({
      ok: true,
      action,
      request_id,
      forced_user_id: forcedUserId,
      message: `🎉 SUCCESS! Approval worked when forcing user ID ${forcedUserId}`,
      result
    });

  } catch (error) {
    console.error('❌ Approval error:', error);
    return Response.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});