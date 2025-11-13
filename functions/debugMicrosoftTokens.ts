import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🔍 ========== TOKEN DEBUGGING STARTED ==========');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const results = {
            user: {
                email: user.email,
                id: user.id,
                role: user.role
            },
            manualToken: null,
            ssoToken: null,
            manualTest: null,
            ssoTest: null,
            comparison: null
        };

        // ========== TEST MANUAL TOKEN ==========
        console.log('\n🔑 ========== TESTING MANUAL TOKEN ==========');
        
        if (user.microsoft_access_token) {
            const manualToken = user.microsoft_access_token.trim();
            
            results.manualToken = {
                exists: true,
                length: manualToken.length,
                firstChars: manualToken.substring(0, 50),
                lastChars: manualToken.substring(manualToken.length - 50),
                hasSpaces: manualToken.includes(' '),
                hasNewlines: manualToken.includes('\n'),
                hasBearerPrefix: manualToken.startsWith('Bearer '),
                parts: manualToken.split('.').length,
                isValidJWT: manualToken.split('.').length === 3,
                expiresAt: user.microsoft_token_expires_at
            };
            
            console.log('📊 Manual Token Info:', JSON.stringify(results.manualToken, null, 2));
            
            // Test manual token with Graph API
            console.log('🧪 Testing manual token with Graph API...');
            try {
                const testResponse = await fetch(
                    'https://graph.microsoft.com/v1.0/users?$top=5&$select=id,displayName,mail',
                    {
                        headers: {
                            'Authorization': `Bearer ${manualToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                const responseText = await testResponse.text();
                
                results.manualTest = {
                    status: testResponse.status,
                    ok: testResponse.ok,
                    statusText: testResponse.statusText
                };
                
                if (testResponse.ok) {
                    const data = JSON.parse(responseText);
                    results.manualTest.success = true;
                    results.manualTest.usersReturned = data.value?.length || 0;
                    results.manualTest.sampleUser = data.value?.[0]?.displayName || null;
                    console.log('✅ Manual token works! Retrieved', results.manualTest.usersReturned, 'users');
                } else {
                    results.manualTest.success = false;
                    results.manualTest.error = responseText;
                    console.log('❌ Manual token failed:', responseText);
                }
            } catch (error) {
                results.manualTest = {
                    success: false,
                    error: error.message,
                    errorType: error.constructor.name
                };
                console.log('❌ Manual token test error:', error.message);
            }
        } else {
            results.manualToken = { exists: false };
            console.log('⚠️ No manual token found');
        }

        // ========== TEST SSO TOKEN ==========
        console.log('\n🔐 ========== TESTING SSO TOKEN ==========');
        
        try {
            const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            
            if (ssoToken) {
                // Analyze raw SSO response
                results.ssoToken = {
                    exists: true,
                    type: typeof ssoToken,
                    isNull: ssoToken === null,
                    isUndefined: ssoToken === undefined,
                    length: ssoToken.length,
                    firstChars: ssoToken.substring(0, 50),
                    lastChars: ssoToken.substring(ssoToken.length - 50),
                    hasSpaces: ssoToken.includes(' '),
                    hasNewlines: ssoToken.includes('\n'),
                    hasBearerPrefix: ssoToken.startsWith('Bearer '),
                    hasTabsOrCarriageReturns: ssoToken.includes('\t') || ssoToken.includes('\r'),
                    parts: ssoToken.split('.').length
                };
                
                // Try to clean it
                let cleanToken = ssoToken.trim();
                if (cleanToken.startsWith('Bearer ')) {
                    cleanToken = cleanToken.substring(7);
                }
                cleanToken = cleanToken.replace(/\s/g, '');
                
                results.ssoToken.cleaned = {
                    length: cleanToken.length,
                    parts: cleanToken.split('.').length,
                    isValidJWT: cleanToken.split('.').length === 3
                };
                
                console.log('📊 SSO Token Info:', JSON.stringify(results.ssoToken, null, 2));
                
                // Test SSO token with Graph API (using cleaned version)
                console.log('🧪 Testing SSO token with Graph API...');
                try {
                    const testResponse = await fetch(
                        'https://graph.microsoft.com/v1.0/users?$top=5&$select=id,displayName,mail',
                        {
                            headers: {
                                'Authorization': `Bearer ${cleanToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    const responseText = await testResponse.text();
                    
                    results.ssoTest = {
                        status: testResponse.status,
                        ok: testResponse.ok,
                        statusText: testResponse.statusText
                    };
                    
                    if (testResponse.ok) {
                        const data = JSON.parse(responseText);
                        results.ssoTest.success = true;
                        results.ssoTest.usersReturned = data.value?.length || 0;
                        results.ssoTest.sampleUser = data.value?.[0]?.displayName || null;
                        console.log('✅ SSO token works! Retrieved', results.ssoTest.usersReturned, 'users');
                    } else {
                        results.ssoTest.success = false;
                        results.ssoTest.error = responseText;
                        console.log('❌ SSO token failed:', responseText);
                        
                        // Try to parse error
                        try {
                            const errorObj = JSON.parse(responseText);
                            results.ssoTest.errorCode = errorObj.error?.code;
                            results.ssoTest.errorMessage = errorObj.error?.message;
                        } catch (e) {
                            // Ignore
                        }
                    }
                } catch (error) {
                    results.ssoTest = {
                        success: false,
                        error: error.message,
                        errorType: error.constructor.name
                    };
                    console.log('❌ SSO token test error:', error.message);
                }
            } else {
                results.ssoToken = { exists: false, reason: 'getAccessToken returned null/undefined' };
                console.log('⚠️ SSO token returned null/undefined');
            }
        } catch (ssoError) {
            results.ssoToken = {
                exists: false,
                error: ssoError.message,
                errorType: ssoError.constructor.name
            };
            console.log('❌ SSO token error:', ssoError.message);
        }

        // ========== COMPARISON ==========
        console.log('\n📊 ========== COMPARISON ==========');
        
        results.comparison = {
            bothExist: results.manualToken?.exists && results.ssoToken?.exists,
            manualWorks: results.manualTest?.success === true,
            ssoWorks: results.ssoTest?.success === true,
            recommendation: null
        };
        
        if (results.comparison.manualWorks && results.comparison.ssoWorks) {
            results.comparison.recommendation = 'Both tokens work! Use SSO for consistency.';
            console.log('✅ Both tokens work!');
        } else if (results.comparison.manualWorks && !results.comparison.ssoWorks) {
            results.comparison.recommendation = 'Manual token works, SSO token fails. Use manual token.';
            console.log('⚠️ Only manual token works');
        } else if (!results.comparison.manualWorks && results.comparison.ssoWorks) {
            results.comparison.recommendation = 'SSO token works, manual token fails. Use SSO token.';
            console.log('⚠️ Only SSO token works');
        } else {
            results.comparison.recommendation = 'Neither token works! Check Microsoft connection.';
            console.log('❌ Neither token works!');
        }
        
        console.log('✅ ========== DEBUGGING COMPLETE ==========\n');

        return Response.json({
            success: true,
            results: results
        });

    } catch (error) {
        console.error('❌ Fatal debug error:', error);
        return Response.json({
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            stack: error.stack
        }, { status: 500 });
    }
});