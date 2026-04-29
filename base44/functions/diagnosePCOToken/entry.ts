import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        steps: []
    };

    try {
        const base44 = createClientFromRequest(req);
        const me = await base44.auth.me();

        diagnostics.base44_user = {
            email: me?.email,
            full_name: me?.full_name
        };
        diagnostics.steps.push('✅ Got Base44 user');

        // Get full user with tokens
        const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
        const user = users[0];

        if (!user?.pco_access_token) {
            diagnostics.steps.push('❌ No PCO token found');
            return Response.json({ ok: false, error: 'No PCO token', diagnostics });
        }

        const token = user.pco_access_token;
        diagnostics.token_preview = token.slice(-10);
        diagnostics.steps.push('✅ Got PCO access token');

        // Check OAuth app configuration
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        diagnostics.oauth_app = {
            client_id: clientId,
            client_id_hash: clientId ? `${clientId.slice(0, 8)}...${clientId.slice(-8)}` : 'NOT SET'
        };
        diagnostics.steps.push(`✅ OAuth Client ID: ${diagnostics.oauth_app.client_id_hash}`);

        // Test 1: Calendar /me endpoint
        try {
            const calendarMeResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (calendarMeResponse.ok) {
                const calendarData = await calendarMeResponse.json();
                diagnostics.calendar_me = {
                    id: calendarData.data?.id,
                    name: calendarData.data?.attributes?.name,
                    email: calendarData.data?.attributes?.email,
                    status: calendarData.data?.attributes?.status,
                    created_at: calendarData.data?.attributes?.created_at,
                    permissions: calendarData.data?.attributes?.permissions
                };
                diagnostics.steps.push(`✅ Calendar /me: User ID ${diagnostics.calendar_me.id}`);
            } else {
                diagnostics.steps.push(`❌ Calendar /me failed: ${calendarMeResponse.status}`);
            }
        } catch (e) {
            diagnostics.steps.push(`❌ Calendar /me error: ${e.message}`);
        }

        // Test 2: People /me endpoint
        try {
            const peopleMeResponse = await fetch('https://api.planningcenteronline.com/people/v2/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (peopleMeResponse.ok) {
                const peopleData = await peopleMeResponse.json();
                diagnostics.people_me = {
                    id: peopleData.data?.id,
                    name: peopleData.data?.attributes?.name,
                    status: peopleData.data?.attributes?.status,
                    child: peopleData.data?.attributes?.child
                };
                diagnostics.steps.push(`✅ People /me: Person ID ${diagnostics.people_me.id}`);
            } else {
                diagnostics.steps.push(`❌ People /me failed: ${peopleMeResponse.status}`);
            }
        } catch (e) {
            diagnostics.steps.push(`❌ People /me error: ${e.message}`);
        }

        // Test 3: Try to get OAuth application info
        try {
            const oauthAppsResponse = await fetch('https://api.planningcenteronline.com/people/v2/me/apps', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (oauthAppsResponse.ok) {
                const appsData = await oauthAppsResponse.json();
                diagnostics.oauth_apps = appsData.data?.map(app => ({
                    id: app.id,
                    name: app.attributes?.name,
                    url: app.attributes?.url
                }));
                diagnostics.steps.push(`✅ Found ${diagnostics.oauth_apps?.length || 0} connected apps`);
            } else {
                diagnostics.steps.push(`❌ OAuth apps query failed: ${oauthAppsResponse.status}`);
            }
        } catch (e) {
            diagnostics.steps.push(`❌ OAuth apps error: ${e.message}`);
        }

        // Test 4: Try a TEST write operation to see what user ID PCO checks
        // We'll try to update a non-existent request to see the error
        try {
            const testRequestId = '99999999'; // Non-existent ID
            const testWriteResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${testRequestId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data: {
                            type: 'EventResourceRequest',
                            id: testRequestId,
                            attributes: { approval_status: 'A' }
                        }
                    })
                }
            );

            const testError = await testWriteResponse.text();
            diagnostics.test_write = {
                status: testWriteResponse.status,
                response: testError
            };

            // Parse error to find user ID
            if (testError.includes('User with id')) {
                const match = testError.match(/User with id (\d+)/);
                if (match) {
                    diagnostics.token_owner_user_id = match[1];
                    diagnostics.steps.push(`🔍 TOKEN OWNER: User ID ${match[1]} (from write operation error)`);
                }
            }
        } catch (e) {
            diagnostics.steps.push(`❌ Test write error: ${e.message}`);
        }

        // Test 5: Check who has write permissions to a real pending request
        try {
            // Get first pending request
            const pendingResponse = await fetch(
                'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=1',
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (pendingResponse.ok) {
                const pendingData = await pendingResponse.json();
                if (pendingData.data && pendingData.data.length > 0) {
                    const requestId = pendingData.data[0].id;
                    diagnostics.sample_pending_request = requestId;
                    diagnostics.steps.push(`✅ Found pending request: ${requestId}`);

                    // Try to approve it to see the error
                    const approveResponse = await fetch(
                        `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${requestId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                data: {
                                    type: 'EventResourceRequest',
                                    id: requestId,
                                    attributes: { approval_status: 'A' }
                                }
                            })
                        }
                    );

                    const approveError = await approveResponse.text();
                    diagnostics.real_approve_attempt = {
                        status: approveResponse.status,
                        response: approveError.substring(0, 500)
                    };

                    if (approveError.includes('User with id')) {
                        const match = approveError.match(/User with id (\d+)/);
                        if (match) {
                            diagnostics.token_owner_confirmed = match[1];
                            diagnostics.steps.push(`🔍 CONFIRMED: Write operations use User ID ${match[1]}`);
                        }
                    }
                }
            }
        } catch (e) {
            diagnostics.steps.push(`❌ Real approve test error: ${e.message}`);
        }

        // Summary
        diagnostics.summary = {
            calendar_user_id: diagnostics.calendar_me?.id,
            people_person_id: diagnostics.people_me?.id,
            token_performs_writes_as: diagnostics.token_owner_confirmed || diagnostics.token_owner_user_id,
            ids_match: diagnostics.calendar_me?.id === (diagnostics.token_owner_confirmed || diagnostics.token_owner_user_id)
        };

        diagnostics.steps.push('');
        diagnostics.steps.push('📊 SUMMARY:');
        diagnostics.steps.push(`   - Calendar /me returns: User ${diagnostics.calendar_me?.id}`);
        diagnostics.steps.push(`   - People /me returns: Person ${diagnostics.people_me?.id}`);
        diagnostics.steps.push(`   - Token performs writes as: User ${diagnostics.summary.token_performs_writes_as}`);
        diagnostics.steps.push(`   - IDs match: ${diagnostics.summary.ids_match ? '✅ YES' : '❌ NO'}`);

        if (!diagnostics.summary.ids_match) {
            diagnostics.steps.push('');
            diagnostics.steps.push('❌ PROBLEM IDENTIFIED:');
            diagnostics.steps.push(`   The OAuth app (Client ID: ${diagnostics.oauth_app.client_id_hash})`);
            diagnostics.steps.push(`   is registered under User ${diagnostics.summary.token_performs_writes_as}'s account,`);
            diagnostics.steps.push(`   but you're trying to act as User ${diagnostics.calendar_me?.id}.`);
            diagnostics.steps.push('');
            diagnostics.steps.push('💡 SOLUTION:');
            diagnostics.steps.push('   1. Register a NEW PCO OAuth app under YOUR account (billy.nelms@fbca.org)');
            diagnostics.steps.push('   2. Update PCO_CLIENT_ID and PCO_CLIENT_SECRET with the new app credentials');
            diagnostics.steps.push('   3. Reconnect PCO in Settings');
            diagnostics.steps.push('   4. Then write operations will work!');
        } else {
            diagnostics.steps.push('');
            diagnostics.steps.push('✅ OAuth configuration looks correct!');
        }

        return Response.json({
            ok: true,
            diagnostics
        });

    } catch (error) {
        console.error('❌ Diagnosis error:', error);
        diagnostics.steps.push(`❌ Fatal error: ${error.message}`);
        diagnostics.error = error.message;
        diagnostics.stack = error.stack;

        return Response.json({
            ok: false,
            diagnostics
        }, { status: 500 });
    }
});