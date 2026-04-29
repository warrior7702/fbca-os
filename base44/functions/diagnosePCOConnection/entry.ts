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
            id: me?.id
        };

        // Get user with tokens
        const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
        const user = users[0];

        if (!user?.pco_access_token) {
            diagnostics.error = 'No PCO token found';
            return Response.json({ ok: false, diagnostics });
        }

        const token = user.pco_access_token;
        diagnostics.token_last_10 = token.slice(-10);
        diagnostics.stored_pco_user_id = user.pco_user_id;

        // Check which OAuth credentials are being used
        diagnostics.oauth_credentials = {
            PCO_CLIENT_ID: Deno.env.get('PCO_CLIENT_ID')?.slice(0, 20) + '...',
            PCO_APP_ID2: Deno.env.get('PCO_APP_ID2')?.slice(0, 20) + '...',
            which_is_set: {
                PCO_CLIENT_ID: !!Deno.env.get('PCO_CLIENT_ID'),
                PCO_CLIENT_SECRET: !!Deno.env.get('PCO_CLIENT_SECRET'),
                PCO_APP_ID2: !!Deno.env.get('PCO_APP_ID2'),
                PCO_SECRET2: !!Deno.env.get('PCO_SECRET2')
            }
        };

        diagnostics.steps.push('✅ Found OAuth credentials');

        // Test 1: Call Calendar /me with the token
        console.log('🔍 Testing Calendar /me...');
        const calendarMeResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (calendarMeResponse.ok) {
            const calendarData = await calendarMeResponse.json();
            diagnostics.calendar_me = {
                id: calendarData.data?.id,
                name: calendarData.data?.attributes?.name,
                email: calendarData.data?.attributes?.email,
                permissions: calendarData.data?.attributes?.permissions
            };
            diagnostics.steps.push(`✅ Calendar /me returns: User ID ${diagnostics.calendar_me.id}`);
        } else {
            diagnostics.steps.push(`❌ Calendar /me failed: ${calendarMeResponse.status}`);
        }

        // Test 2: Try a test PATCH to see what user PCO uses
        console.log('🔍 Testing write operation to see what user ID PCO uses...');
        const testRequestId = '99999999'; // Fake ID
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
        diagnostics.test_write_response = {
            status: testResponse.status,
            body: testError
        };

        // Parse the user ID from error
        if (testError.includes('User with id')) {
            const match = testError.match(/User with id (\d+)/);
            if (match) {
                diagnostics.token_performs_writes_as = match[1];
                diagnostics.steps.push(`🔍 PCO says this token performs writes as: User ID ${match[1]}`);
            }
        }

        // Test 3: Introspect the token (check what OAuth app issued it)
        console.log('🔍 Checking OAuth token introspection...');
        try {
            const introspectResponse = await fetch('https://api.planningcenteronline.com/oauth/introspect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(`${Deno.env.get('PCO_CLIENT_ID')}:${Deno.env.get('PCO_CLIENT_SECRET')}`)}`
                },
                body: `token=${token}`
            });

            if (introspectResponse.ok) {
                const introspectData = await introspectResponse.json();
                diagnostics.token_introspection = introspectData;
                diagnostics.steps.push('✅ Got token introspection data');
            } else {
                diagnostics.steps.push(`❌ Token introspection failed: ${introspectResponse.status}`);
            }
        } catch (e) {
            diagnostics.steps.push(`❌ Token introspection error: ${e.message}`);
        }

        // Summary
        diagnostics.verdict = {
            calendar_me_id: diagnostics.calendar_me?.id,
            token_writes_as: diagnostics.token_performs_writes_as,
            stored_id: diagnostics.stored_pco_user_id,
            ids_match: diagnostics.calendar_me?.id === diagnostics.token_performs_writes_as,
            problem: diagnostics.token_performs_writes_as === '3566727' ? 
                'TOKEN IS STILL FROM OLD OAUTH APP (user 3566727)' : 
                (diagnostics.calendar_me?.id !== diagnostics.token_performs_writes_as ? 
                    'Token user ID mismatch' : 
                    'Configuration looks correct')
        };

        diagnostics.steps.push('');
        diagnostics.steps.push('📊 VERDICT:');
        diagnostics.steps.push(`   Calendar /me: ${diagnostics.calendar_me?.id}`);
        diagnostics.steps.push(`   Token writes as: ${diagnostics.token_performs_writes_as}`);
        diagnostics.steps.push(`   Problem: ${diagnostics.verdict.problem}`);

        if (diagnostics.token_performs_writes_as === '3566727') {
            diagnostics.steps.push('');
            diagnostics.steps.push('❌ TOKEN IS STILL ISSUED BY OLD OAUTH APP!');
            diagnostics.steps.push('   Possible causes:');
            diagnostics.steps.push('   1. Callback function is using wrong credentials (PCO_APP_ID2 vs PCO_CLIENT_ID)');
            diagnostics.steps.push('   2. You need to fully log out and reconnect');
            diagnostics.steps.push('   3. Token refresh is using old credentials');
        }

        return Response.json({
            ok: true,
            diagnostics
        });

    } catch (error) {
        console.error('❌ Diagnostic error:', error);
        diagnostics.steps.push(`❌ Error: ${error.message}`);
        diagnostics.error = error.message;

        return Response.json({
            ok: false,
            diagnostics
        }, { status: 500 });
    }
});