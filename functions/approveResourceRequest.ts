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
    const action = String(body.action || '').trim().toLowerCase();
    const note = body.note ? String(body.note) : undefined;

    console.log('📋 Approval request:', { request_id, action, user: me.email });

    if (!request_id || !['approve', 'deny'].includes(action)) {
      return Response.json(
        { ok: false, error: 'request_id and action=approve|deny required' },
        { status: 400 }
      );
    }

    // CRITICAL FIX: Get user's PCO token from DATABASE, not from session!
    // Session object might have stale/cached token
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
    console.log('✅ Using FRESH token from database for:', me.email);
    console.log('📊 Token last 10 chars:', userToken.slice(-10));

    // Determine status code
    const statusCode = action === 'approve' ? 'A' : 'R';
    const url = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`;
    
    console.log('🚀 PATCH', url);
    console.log('   Status:', statusCode);
    
    // Build PATCH body
    const patchBody = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: statusCode
        }
      }
    };

    if (note) {
      patchBody.data.attributes.notes = note;
    }

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
    
    console.log('📊 PCO Response:', response.status);
    
    if (!response.ok) {
      console.error('❌ PCO Error:', responseText);
      
      // Parse error message
      let errorMsg = 'Permission denied';
      if (response.status === 403) {
        errorMsg = 'You are not authorized to approve this resource. Make sure you are in the correct approval group.';
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
        details: responseText
      }, { status: response.status });
    }

    console.log('✅ Success!');
    
    const result = responseText ? JSON.parse(responseText) : { ok: true };
    
    // If approved, also save door code locally
    if (action === 'approve' && body.event_id && body.door_code) {
      try {
        // Check if LocalEventCode already exists for this event
        const existing = await base44.asServiceRole.entities.LocalEventCode.filter({
          event_id: String(body.event_id)
        });
        
        if (existing.length === 0) {
          // Create new LocalEventCode record
          await base44.asServiceRole.entities.LocalEventCode.create({
            event_id: String(body.event_id),
            event_name: body.event_name || '',
            event_date: body.event_date || new Date().toISOString(),
            access_time: body.access_time || '',
            door_code: body.door_code
          });
          console.log('✅ LocalEventCode created for event:', body.event_id);
        } else {
          // Update existing
          await base44.asServiceRole.entities.LocalEventCode.update(existing[0].id, {
            door_code: body.door_code,
            access_time: body.access_time || existing[0].access_time
          });
          console.log('✅ LocalEventCode updated for event:', body.event_id);
        }
      } catch (err) {
        console.error('⚠️ Failed to save LocalEventCode:', err);
        // Don't fail the approval, just log it
      }
    }
    
    return Response.json({
      ok: true,
      action,
      request_id,
      message: action === 'approve' ? 'Request approved successfully' : 'Request denied successfully',
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