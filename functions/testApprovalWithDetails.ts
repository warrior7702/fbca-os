import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    if (!me) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const request_id = String(body.request_id || '').trim();

    if (!request_id) {
      return Response.json({ error: 'request_id required' }, { status: 400 });
    }

    console.log('🧪 DETAILED APPROVAL TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 User:', me.email);
    console.log('📋 Request ID:', request_id);

    // Get fresh token from database
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json({ error: 'No PCO token found' }, { status: 401 });
    }

    const token = user.pco_access_token;
    console.log('✅ Token found (last 10):', token.slice(-10));

    const report = {
      user_email: me.email,
      request_id: request_id,
      timestamp: new Date().toISOString(),
      steps: []
    };

    // STEP 1: Check who the token belongs to
    console.log('\n🔬 STEP 1: Check token owner via /me');
    try {
      const meRes = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (meRes.ok) {
        const meData = await meRes.json();
        const userId = meData.data?.id;
        const userName = meData.data?.attributes?.name;
        
        report.steps.push({
          step: 'Calendar /me',
          success: true,
          user_id: userId,
          user_name: userName
        });
        
        console.log('✅ Token belongs to user:', userId, '-', userName);
      } else {
        report.steps.push({
          step: 'Calendar /me',
          success: false,
          error: await meRes.text()
        });
      }
    } catch (error) {
      report.steps.push({
        step: 'Calendar /me',
        success: false,
        error: error.message
      });
    }

    // STEP 2: Fetch the request details
    console.log('\n🔬 STEP 2: Fetch request details');
    try {
      const reqRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        report.steps.push({
          step: 'Fetch Request',
          success: true,
          request_data: {
            id: reqData.data?.id,
            approval_status: reqData.data?.attributes?.approval_status,
            resource_name: reqData.data?.relationships?.resource?.data?.id
          }
        });
        
        console.log('✅ Request found:', reqData.data?.id);
        console.log('   Status:', reqData.data?.attributes?.approval_status);
      } else {
        const errorText = await reqRes.text();
        report.steps.push({
          step: 'Fetch Request',
          success: false,
          status: reqRes.status,
          error: errorText
        });
        console.log('❌ Failed to fetch request:', errorText);
      }
    } catch (error) {
      report.steps.push({
        step: 'Fetch Request',
        success: false,
        error: error.message
      });
    }

    // STEP 3: Try to approve
    console.log('\n🔬 STEP 3: Attempt approval (PATCH)');
    const patchUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`;
    const patchBody = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A'
        }
      }
    };

    console.log('📤 PATCH', patchUrl);
    console.log('📦 Body:', JSON.stringify(patchBody, null, 2));

    try {
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchBody)
      });

      const responseText = await patchRes.text();
      
      console.log('📊 Response Status:', patchRes.status);
      console.log('📊 Response Body:', responseText);

      if (patchRes.ok) {
        report.steps.push({
          step: 'PATCH Approval',
          success: true,
          status: patchRes.status,
          response: responseText
        });
        console.log('✅ SUCCESS! Approval worked!');
      } else {
        // Parse the error
        let parsedError = null;
        try {
          parsedError = JSON.parse(responseText);
        } catch {
          parsedError = responseText;
        }

        report.steps.push({
          step: 'PATCH Approval',
          success: false,
          status: patchRes.status,
          error: responseText,
          parsed_error: parsedError
        });

        console.log('❌ FAILED!');
        console.log('   Status:', patchRes.status);
        console.log('   Error:', responseText);

        // Check for specific error patterns
        if (responseText.includes('User with id')) {
          const match = responseText.match(/User with id (\d+)/);
          if (match) {
            console.log('🚨 FOUND IT! Token writes as user:', match[1]);
            report.phantom_user_detected = match[1];
          }
        }

        if (responseText.includes('not authorized') || responseText.includes('permission')) {
          console.log('🔒 Permission issue detected');
          report.permission_issue = true;
        }
      }
    } catch (error) {
      report.steps.push({
        step: 'PATCH Approval',
        success: false,
        error: error.message
      });
      console.log('❌ Request failed:', error.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST COMPLETE');
    
    return Response.json({
      ok: true,
      report: report
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});