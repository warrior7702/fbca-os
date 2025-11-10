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

    console.log('🧪 TESTING DIFFERENT APPROVAL FORMATS FOR:', request_id);

    // Get fresh token
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json({ error: 'No PCO token' }, { status: 400 });
    }

    const token = user.pco_access_token;
    const myCalendarUserId = user.pco_user_id || '149670080';

    const report = {
      timestamp: new Date().toISOString(),
      request_id: request_id,
      my_calendar_user_id: myCalendarUserId,
      tests: []
    };

    // TEST 1: Standard format (what we currently do)
    console.log('\n📋 TEST 1: Standard attributes only');
    const test1Body = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A'
        }
      }
    };

    const test1 = await testFormat('Standard Format', test1Body);
    report.tests.push(test1);

    // TEST 2: With approved_by_id in attributes
    console.log('\n📋 TEST 2: With approved_by_id in attributes');
    const test2Body = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A',
          approved_by_id: myCalendarUserId
        }
      }
    };

    const test2 = await testFormat('Approved By ID in Attributes', test2Body);
    report.tests.push(test2);

    // TEST 3: With relationships approved_by
    console.log('\n📋 TEST 3: With relationships approved_by');
    const test3Body = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A'
        },
        relationships: {
          approved_by: {
            data: {
              type: 'Person',
              id: myCalendarUserId
            }
          }
        }
      }
    };

    const test3 = await testFormat('Approved By in Relationships', test3Body);
    report.tests.push(test3);

    // TEST 4: Minimal format
    console.log('\n📋 TEST 4: Minimal format');
    const test4Body = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A'
        }
      }
    };

    const test4 = await testFormat('Minimal Format', test4Body);
    report.tests.push(test4);

    // TEST 5: With meta context
    console.log('\n📋 TEST 5: With meta user context');
    const test5Body = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: 'A'
        },
        meta: {
          user_id: myCalendarUserId
        }
      }
    };

    const test5 = await testFormat('With Meta User Context', test5Body);
    report.tests.push(test5);

    // Helper function to test each format
    async function testFormat(name, body) {
      try {
        const response = await fetch(`https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const responseText = await response.text();
        
        const result = {
          test_name: name,
          status: response.status,
          ok: response.ok,
          request_body: body
        };

        if (response.ok) {
          result.success = true;
          result.response = responseText;
          console.log('✅ SUCCESS:', name);
        } else {
          result.success = false;
          result.error = responseText;
          
          // Check if still mentions 3566727
          if (responseText.includes('3566727')) {
            result.still_uses_phantom = true;
          }
          
          console.log('❌ FAILED:', name, '-', response.status);
        }

        return result;

      } catch (error) {
        return {
          test_name: name,
          success: false,
          error: error.message,
          request_body: body
        };
      }
    }

    // Generate verdict
    const successfulTests = report.tests.filter(t => t.success);
    
    if (successfulTests.length > 0) {
      report.verdict = {
        found_working_format: true,
        working_formats: successfulTests.map(t => t.test_name),
        recommendation: `Use format: ${successfulTests[0].test_name}`
      };
    } else {
      report.verdict = {
        found_working_format: false,
        message: 'None of the tested formats worked. The issue may be with approval group permissions or resource ownership.',
        all_still_use_phantom: report.tests.every(t => t.still_uses_phantom)
      };
    }

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