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

    console.log('🔍 DEEP INVESTIGATION OF REQUEST:', request_id);

    // Get token
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json({ error: 'No PCO token' }, { status: 400 });
    }

    const token = user.pco_access_token;

    const report = {
      timestamp: new Date().toISOString(),
      request_id: request_id,
      user_email: me.email,
      findings: []
    };

    // STEP 1: Get the request details
    console.log('📋 STEP 1: Fetching request details...');
    try {
      const reqRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        const request = reqData.data;
        
        report.request = {
          id: request.id,
          approval_status: request.attributes?.approval_status,
          quantity: request.attributes?.quantity,
          created_at: request.attributes?.created_at,
          updated_at: request.attributes?.updated_at,
          event_id: request.relationships?.event?.data?.id,
          resource_id: request.relationships?.resource?.data?.id,
          created_by_id: request.relationships?.created_by?.data?.id,
          updated_by_id: request.relationships?.updated_by?.data?.id
        };
        
        console.log('✅ Request details:', report.request);
      } else {
        report.findings.push('❌ Failed to fetch request details');
      }
    } catch (error) {
      report.findings.push(`❌ Error fetching request: ${error.message}`);
    }

    // STEP 2: Get the event details
    if (report.request?.event_id) {
      console.log('📅 STEP 2: Fetching event details...');
      try {
        const eventRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/events/${report.request.event_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          const event = eventData.data;
          
          report.event = {
            id: event.id,
            name: event.attributes?.name,
            approval_status: event.attributes?.approval_status,
            owner_id: event.relationships?.owner?.data?.id,
            created_by_id: event.relationships?.created_by?.data?.id
          };
          
          console.log('✅ Event details:', report.event);
          
          // Check if owner is phantom
          if (report.event.owner_id === '3566727') {
            report.findings.push('🚨 FOUND IT! Event is OWNED by user 3566727!');
          }
          
          if (report.event.created_by_id === '3566727') {
            report.findings.push('🚨 FOUND IT! Event was CREATED by user 3566727!');
          }
        }
      } catch (error) {
        report.findings.push(`❌ Error fetching event: ${error.message}`);
      }
    }

    // STEP 3: Get the resource details
    if (report.request?.resource_id) {
      console.log('📦 STEP 3: Fetching resource details...');
      try {
        const resourceRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/resources/${report.request.resource_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (resourceRes.ok) {
          const resourceData = await resourceRes.json();
          const resource = resourceData.data;
          
          report.resource = {
            id: resource.id,
            name: resource.attributes?.name,
            kind: resource.attributes?.kind,
            created_by_id: resource.relationships?.created_by?.data?.id,
            resource_folder_id: resource.relationships?.resource_folder?.data?.id
          };
          
          console.log('✅ Resource details:', report.resource);
          
          if (report.resource.created_by_id === '3566727') {
            report.findings.push('🚨 FOUND IT! Resource was CREATED by user 3566727!');
          }
        }
      } catch (error) {
        report.findings.push(`❌ Error fetching resource: ${error.message}`);
      }
    }

    // STEP 4: Check who created the request
    if (report.request?.created_by_id) {
      console.log('👤 STEP 4: Checking request creator...');
      
      if (report.request.created_by_id === '3566727') {
        report.findings.push('🚨 FOUND IT! Request was CREATED by user 3566727!');
      } else {
        console.log(`✅ Request created by: ${report.request.created_by_id}`);
      }
    }

    // STEP 5: Try to approve and capture the EXACT error
    console.log('🧪 STEP 5: Attempting approval to capture error...');
    try {
      const approvalRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            type: 'EventResourceRequest',
            id: request_id,
            attributes: {
              approval_status: 'A'
            }
          }
        })
      });

      const responseText = await approvalRes.text();
      
      report.approval_attempt = {
        status: approvalRes.status,
        ok: approvalRes.ok,
        response: responseText
      };

      if (!approvalRes.ok) {
        console.log('❌ Approval failed:', responseText);
        
        // Check for phantom user in error
        if (responseText.includes('User with id')) {
          const match = responseText.match(/User with id (\d+)/);
          if (match) {
            const userId = match[1];
            report.findings.push(`🚨 APPROVAL ERROR MENTIONS USER: ${userId}`);
            
            if (userId === '3566727') {
              report.findings.push('🚨🚨🚨 CONFIRMED! Approval fails because of user 3566727!');
            }
          }
        }
      } else {
        report.findings.push('✅ Approval succeeded! (We just approved it for testing)');
      }
    } catch (error) {
      report.findings.push(`❌ Error during approval attempt: ${error.message}`);
    }

    // STEP 6: Look up user 3566727 in PCO
    console.log('🔍 STEP 6: Looking up user 3566727...');
    try {
      const userRes = await fetch('https://api.planningcenteronline.com/calendar/v2/people/3566727', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userRes.ok) {
        const userData = await userRes.json();
        report.phantom_user = {
          exists: true,
          id: userData.data?.id,
          name: userData.data?.attributes?.name,
          email: userData.data?.attributes?.email,
          status: userData.data?.attributes?.status,
          permissions: userData.data?.attributes?.permissions
        };
        
        report.findings.push(`✅ User 3566727 EXISTS in PCO Calendar! Name: ${report.phantom_user.name}, Email: ${report.phantom_user.email}`);
      } else {
        report.phantom_user = { exists: false };
        report.findings.push('❌ User 3566727 does NOT exist in PCO Calendar');
      }
    } catch (error) {
      report.findings.push(`❌ Error looking up user 3566727: ${error.message}`);
    }

    // VERDICT
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 INVESTIGATION COMPLETE');
    console.log('═══════════════════════════════════════════════════');

    report.verdict = {
      phantom_found: report.findings.some(f => f.includes('3566727')),
      locations: []
    };

    if (report.event?.owner_id === '3566727') {
      report.verdict.locations.push('Event Owner');
    }
    if (report.event?.created_by_id === '3566727') {
      report.verdict.locations.push('Event Creator');
    }
    if (report.resource?.created_by_id === '3566727') {
      report.verdict.locations.push('Resource Creator');
    }
    if (report.request?.created_by_id === '3566727') {
      report.verdict.locations.push('Request Creator');
    }

    if (report.verdict.locations.length > 0) {
      report.verdict.conclusion = `User 3566727 is the ${report.verdict.locations.join(', ')}! This is why approvals are failing.`;
      report.verdict.solution = [
        'User 3566727 likely has restricted permissions or is inactive',
        'Transfer ownership of events/resources from 3566727 to an active user',
        'Or: Reactivate user 3566727 in PCO Calendar settings'
      ];
    } else {
      report.verdict.conclusion = 'User 3566727 not found in obvious places. Check approval error message.';
      report.verdict.solution = ['Review the approval_attempt response for clues'];
    }

    console.log('Verdict:', report.verdict);

    return Response.json({
      ok: true,
      report: report
    });

  } catch (error) {
    console.error('❌ Investigation error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});