import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const report = {
        timestamp: new Date().toISOString(),
        steps: [],
        tests: {}
    };

    try {
        const base44 = createClientFromRequest(req);
        const me = await base44.auth.me();

        if (!me) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        report.user = {
            email: me.email,
            id: me.id
        };
        report.steps.push(`✅ Authenticated as: ${me.email}`);

        // Get user with tokens
        const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
        const user = users[0];

        if (!user?.pco_access_token) {
            report.steps.push('❌ No PCO token found in database');
            return Response.json({ ok: false, report });
        }

        const token = user.pco_access_token;
        report.token_info = {
            last_10_chars: token.slice(-10),
            stored_pco_user_id: user.pco_user_id,
            expires_at: user.pco_token_expires_at,
            token_length: token.length
        };
        report.steps.push('✅ Found PCO token in database');
        report.steps.push(`📋 Stored PCO User ID: ${user.pco_user_id || 'null'}`);

        // Check environment credentials
        const clientId = Deno.env.get('PCO_CLIENT_ID');
        const clientSecret = Deno.env.get('PCO_CLIENT_SECRET');
        const appId2 = Deno.env.get('PCO_APP_ID2');
        const secret2 = Deno.env.get('PCO_SECRET2');

        report.environment = {
            PCO_CLIENT_ID: clientId ? `${clientId.slice(0, 20)}...` : 'NOT SET',
            PCO_CLIENT_SECRET: clientSecret ? 'SET' : 'NOT SET',
            PCO_APP_ID2: appId2 ? `${appId2.slice(0, 20)}...` : 'NOT SET',
            PCO_SECRET2: secret2 ? 'SET' : 'NOT SET'
        };
        report.steps.push('✅ Environment credentials checked');

        // TEST 1: Token introspection with PCO_CLIENT_ID
        report.steps.push('');
        report.steps.push('🔬 TEST 1: Token Introspection with PCO_CLIENT_ID');
        try {
            const introspectResponse = await fetch('https://api.planningcenteronline.com/oauth/introspect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
                },
                body: `token=${token}`
            });

            if (introspectResponse.ok) {
                const introspectData = await introspectResponse.json();
                report.tests.introspection_with_new_app = {
                    status: 'success',
                    active: introspectData.active,
                    scope: introspectData.scope,
                    client_id: introspectData.client_id,
                    username: introspectData.username,
                    token_type: introspectData.token_type,
                    full_data: introspectData
                };
                
                if (introspectData.active) {
                    report.steps.push(`✅ Token IS valid for PCO_CLIENT_ID`);
                    report.steps.push(`   Client: ${introspectData.client_id}`);
                    report.steps.push(`   Username: ${introspectData.username}`);
                } else {
                    report.steps.push(`❌ Token is NOT valid for PCO_CLIENT_ID`);
                    report.steps.push(`   This means the token was NOT issued by this OAuth app!`);
                }
            } else {
                report.tests.introspection_with_new_app = {
                    status: 'failed',
                    http_status: introspectResponse.status,
                    error: await introspectResponse.text()
                };
                report.steps.push(`❌ Introspection failed: ${introspectResponse.status}`);
            }
        } catch (e) {
            report.tests.introspection_with_new_app = { status: 'error', error: e.message };
            report.steps.push(`❌ Introspection error: ${e.message}`);
        }

        // TEST 2: Token introspection with PCO_APP_ID2 (if exists)
        if (appId2 && secret2 && appId2 !== 'delete') {
            report.steps.push('');
            report.steps.push('🔬 TEST 2: Token Introspection with PCO_APP_ID2');
            try {
                const introspectResponse = await fetch('https://api.planningcenteronline.com/oauth/introspect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${btoa(`${appId2}:${secret2}`)}`
                    },
                    body: `token=${token}`
                });

                if (introspectResponse.ok) {
                    const introspectData = await introspectResponse.json();
                    report.tests.introspection_with_old_app = {
                        status: 'success',
                        active: introspectData.active,
                        scope: introspectData.scope,
                        client_id: introspectData.client_id,
                        username: introspectData.username,
                        full_data: introspectData
                    };
                    
                    if (introspectData.active) {
                        report.steps.push(`⚠️ Token IS valid for PCO_APP_ID2 (OLD APP)`);
                        report.steps.push(`   THIS IS THE PROBLEM! Token was issued by the OLD OAuth app!`);
                        report.steps.push(`   Client: ${introspectData.client_id}`);
                    } else {
                        report.steps.push(`✅ Token is NOT valid for PCO_APP_ID2`);
                    }
                }
            } catch (e) {
                report.tests.introspection_with_old_app = { status: 'error', error: e.message };
            }
        }

        // TEST 3: Call Calendar /me
        report.steps.push('');
        report.steps.push('🔬 TEST 3: Calendar /me endpoint');
        try {
            const calendarMeResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (calendarMeResponse.ok) {
                const calendarData = await calendarMeResponse.json();
                report.tests.calendar_me = {
                    status: 'success',
                    user_id: calendarData.data?.id,
                    name: calendarData.data?.attributes?.name,
                    email: calendarData.data?.attributes?.email,
                    permissions: calendarData.data?.attributes?.permissions
                };
                report.steps.push(`✅ Calendar User ID: ${calendarData.data?.id}`);
                report.steps.push(`   Name: ${calendarData.data?.attributes?.name}`);
                report.steps.push(`   Email: ${calendarData.data?.attributes?.email}`);
            } else {
                report.tests.calendar_me = {
                    status: 'failed',
                    http_status: calendarMeResponse.status,
                    error: await calendarMeResponse.text()
                };
                report.steps.push(`❌ Calendar /me failed: ${calendarMeResponse.status}`);
            }
        } catch (e) {
            report.tests.calendar_me = { status: 'error', error: e.message };
            report.steps.push(`❌ Error: ${e.message}`);
        }

        // TEST 4: Try a write operation
        report.steps.push('');
        report.steps.push('🔬 TEST 4: Test Write Operation');
        try {
            const testRequestId = '99999999'; // Non-existent
            const testResponse = await fetch(
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

            const testError = await testResponse.text();
            report.tests.write_test = {
                status: testResponse.status,
                response: testError
            };

            // Parse user ID from error
            if (testError.includes('User with id')) {
                const match = testError.match(/User with id (\d+)/);
                if (match) {
                    report.token_writes_as_user = match[1];
                    report.steps.push(`🔍 Token performs writes as: User ${match[1]}`);
                    
                    if (match[1] === '3566727') {
                        report.steps.push(`❌ THIS IS THE OLD USER! Token is from the wrong OAuth app!`);
                    }
                }
            }
        } catch (e) {
            report.tests.write_test = { status: 'error', error: e.message };
        }

        // FINAL VERDICT
        report.steps.push('');
        report.steps.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        report.steps.push('📊 FINAL VERDICT:');
        report.steps.push('');

        const isNewAppActive = report.tests.introspection_with_new_app?.active;
        const isOldAppActive = report.tests.introspection_with_old_app?.active;
        const writesAsOldUser = report.token_writes_as_user === '3566727';

        report.verdict = {
            token_is_from_new_app: isNewAppActive,
            token_is_from_old_app: isOldAppActive,
            writes_as_user: report.token_writes_as_user,
            calendar_user_id: report.tests.calendar_me?.user_id,
            problem_identified: false,
            solution: []
        };

        if (isOldAppActive && !isNewAppActive) {
            report.verdict.problem_identified = true;
            report.verdict.problem = 'Token was issued by PCO_APP_ID2 (old OAuth app), not PCO_CLIENT_ID';
            report.steps.push('❌ PROBLEM: Token is from the OLD OAuth app');
            report.steps.push('');
            report.steps.push('🔧 SOLUTION:');
            report.steps.push('1. The connection flow is still using PCO_APP_ID2 somewhere');
            report.steps.push('2. Check pcoCallback function - is it using the right client ID?');
            report.steps.push('3. DELETE PCO_APP_ID2 and PCO_SECRET2 from secrets completely');
            report.steps.push('4. Then disconnect and reconnect PCO');
            report.verdict.solution = [
                'Delete PCO_APP_ID2 and PCO_SECRET2 secrets',
                'Disconnect PCO in Settings',
                'Reconnect PCO in Settings',
                'Try approval again'
            ];
        } else if (writesAsOldUser) {
            report.verdict.problem_identified = true;
            report.verdict.problem = `Token writes as user ${report.token_writes_as_user} (old user)`;
            report.steps.push(`❌ PROBLEM: Token writes as user ${report.token_writes_as_user}`);
            report.steps.push('');
            report.steps.push('🔧 SOLUTION:');
            report.steps.push('1. The OAuth app may be registered under the wrong PCO account');
            report.steps.push('2. Go to https://api.planningcenteronline.com/oauth/applications');
            report.steps.push('3. Make sure the app is registered under billy.nelms@fbca.org');
            report.steps.push('4. Or create a NEW OAuth app under billy.nelms@fbca.org');
            report.verdict.solution = [
                'Check OAuth app registration in PCO',
                'Ensure app is registered under correct account',
                'Create new OAuth app if needed',
                'Update PCO_CLIENT_ID and PCO_CLIENT_SECRET'
            ];
        } else if (isNewAppActive && report.tests.calendar_me?.user_id) {
            report.steps.push('✅ Token configuration looks CORRECT!');
            report.steps.push(`   - Token is valid for PCO_CLIENT_ID`);
            report.steps.push(`   - Calendar User ID: ${report.tests.calendar_me.user_id}`);
            report.steps.push(`   - Writes as: ${report.token_writes_as_user || 'unknown'}`);
            report.steps.push('');
            report.steps.push('💡 If approvals still fail, the issue might be:');
            report.steps.push('   - You are not in the correct approval group');
            report.steps.push('   - The resource requires different permissions');
            report.steps.push('   - PCO caching (wait 5-10 minutes)');
        } else {
            report.steps.push('⚠️ INCONCLUSIVE - need more investigation');
            report.steps.push('   Token validation returned unexpected results');
        }

        report.steps.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return Response.json({
            ok: true,
            report
        });

    } catch (error) {
        console.error('❌ Diagnostic error:', error);
        report.steps.push(`❌ Fatal error: ${error.message}`);
        report.error = error.message;
        report.stack = error.stack;

        return Response.json({
            ok: false,
            report
        }, { status: 500 });
    }
});