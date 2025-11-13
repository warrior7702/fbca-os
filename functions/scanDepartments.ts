import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🚀 ========== DEPARTMENT SCAN STARTED ==========');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        console.log('✅ User authenticated:', user?.email, '| Role:', user?.role);
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin' && user.role !== 'super_user') {
            return Response.json({ 
                error: 'Forbidden - Admin access required' 
            }, { status: 403 });
        }

        console.log('🔑 ========== TOKEN ACQUISITION ==========');
        console.log('   User email:', user.email);
        console.log('   Email domain:', user.email?.split('@')[1]);
        console.log('   Has manual token:', !!user.microsoft_access_token);

        // Try SSO token FIRST
        let accessToken = null;
        let tokenSource = null;
        
        console.log('🔐 Step 1: Attempting SSO token...');
        try {
            accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            if (accessToken) {
                tokenSource = 'SSO';
                console.log('✅ SSO token retrieved!');
                console.log('   Token length:', accessToken.length);
                console.log('   Token starts with:', accessToken.substring(0, 20) + '...');
                console.log('   Token has dots (JWT):', accessToken.includes('.'));
                console.log('   Token parts count:', accessToken.split('.').length);
            } else {
                console.log('⚠️ SSO token returned null/undefined');
            }
        } catch (ssoError) {
            console.log('❌ SSO error:', ssoError.message);
            console.log('   Error type:', ssoError.constructor.name);
            console.log('   Error stack:', ssoError.stack);
        }
        
        // Fall back to manual token
        if (!accessToken && user.microsoft_access_token) {
            tokenSource = 'Manual';
            accessToken = user.microsoft_access_token;
            console.log('⚠️ Using manual token as fallback');
            console.log('   Token length:', accessToken.length);
            console.log('   Token starts with:', accessToken.substring(0, 20) + '...');
            console.log('   Token has dots (JWT):', accessToken.includes('.'));
            console.log('   Token parts count:', accessToken.split('.').length);
            
            // Validate manual token format
            if (!accessToken.includes('.') || accessToken.split('.').length !== 3) {
                console.error('❌ Manual token is malformed (not a valid JWT)');
                return Response.json({
                    success: false,
                    error: 'Microsoft token is corrupted',
                    details: 'Your manually connected Microsoft token is invalid. Please remove it and use SSO instead.',
                    needsReconnection: true,
                    tokenSource: 'Manual (Corrupted)',
                    users: []
                }, { status: 400 });
            }
        }
        
        if (!accessToken) {
            console.error('❌ No Microsoft access token available');
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                details: 'Please log in with Microsoft SSO, or connect Microsoft 365 manually in Settings.',
                needsConnection: true,
                users: []
            }, { status: 400 });
        }

        console.log(`✅ Using token from: ${tokenSource}`);
        console.log('🔑 ========== END TOKEN ACQUISITION ==========\n');

        // Call Microsoft Graph API
        console.log('📡 Calling Microsoft Graph API...');
        const graphUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation,companyName,employeeId&$top=999';
        
        console.log('🔗 URL:', graphUrl);
        console.log('🔑 Auth header format: Bearer [token]');
        
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📥 Graph API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ========== GRAPH API ERROR ==========');
            console.error('Status:', response.status);
            console.error('Response:', errorText);
            console.error('Token source:', tokenSource);
            console.error('Token length:', accessToken.length);
            console.error('Token format valid:', accessToken.includes('.') && accessToken.split('.').length === 3);
            
            if (response.status === 401) {
                // Parse error details
                let errorObj = {};
                try {
                    errorObj = JSON.parse(errorText);
                } catch (e) {
                    // Ignore parse errors
                }
                
                if (tokenSource === 'Manual') {
                    return Response.json({
                        success: false,
                        error: 'Manual Microsoft token is invalid',
                        details: 'Your manually connected Microsoft token cannot be used. Remove it and use SSO instead.',
                        needsReconnection: true,
                        tokenSource: tokenSource,
                        graphError: errorObj.error?.message || errorText,
                        users: []
                    }, { status: 401 });
                } else {
                    return Response.json({
                        success: false,
                        error: 'SSO token was rejected by Microsoft',
                        details: 'Your SSO session may have expired. Please log out and log back in.',
                        needsRelogin: true,
                        tokenSource: tokenSource,
                        graphError: errorObj.error?.message || errorText,
                        users: []
                    }, { status: 401 });
                }
            }
            
            if (response.status === 403) {
                return Response.json({
                    success: false,
                    error: 'Insufficient permissions',
                    details: 'Your Microsoft account needs User.Read.All or Directory.Read.All permissions.',
                    needsPermissions: true,
                    users: []
                }, { status: 403 });
            }
            
            return Response.json({
                success: false,
                error: `Graph API error: ${response.status}`,
                details: errorText,
                users: []
            }, { status: response.status });
        }

        const data = await response.json();
        const o365Users = data.value || [];

        console.log(`✅ Retrieved ${o365Users.length} users from O365`);

        // Analyze departments
        const stats = {
            total: o365Users.length,
            withDepartment: 0,
            withoutDepartment: 0,
            withJobTitle: 0,
            withoutJobTitle: 0,
            departments: {}
        };

        o365Users.forEach(user => {
            if (user.department) {
                stats.withDepartment++;
                stats.departments[user.department] = (stats.departments[user.department] || 0) + 1;
            } else {
                stats.withoutDepartment++;
            }

            if (user.jobTitle) {
                stats.withJobTitle++;
            } else {
                stats.withoutJobTitle++;
            }
        });

        console.log('📊 Department stats:', JSON.stringify(stats, null, 2));

        // Get Base44 users for comparison
        console.log('📊 Loading Base44 users...');
        const base44Users = await base44.asServiceRole.entities.User.list();
        console.log(`✅ Retrieved ${base44Users.length} Base44 users`);

        // Compare data
        const comparisonData = o365Users.map(o365User => {
            const base44User = base44Users.find(u => 
                u.email?.toLowerCase() === o365User.mail?.toLowerCase() ||
                u.email?.toLowerCase() === o365User.userPrincipalName?.toLowerCase()
            );

            return {
                displayName: o365User.displayName,
                email: o365User.mail || o365User.userPrincipalName,
                o365Department: o365User.department || null,
                o365JobTitle: o365User.jobTitle || null,
                o365Location: o365User.officeLocation || null,
                o365Company: o365User.companyName || null,
                o365EmployeeId: o365User.employeeId || null,
                base44Department: base44User?.department || null,
                base44Role: base44User?.role || null,
                inBase44: !!base44User,
                departmentMatch: o365User.department === base44User?.department,
                needsSync: !base44User || (o365User.department && o365User.department !== base44User?.department)
            };
        });

        const syncStats = {
            inBothSystems: comparisonData.filter(u => u.inBase44).length,
            notInBase44: comparisonData.filter(u => !u.inBase44).length,
            departmentMatches: comparisonData.filter(u => u.departmentMatch && u.o365Department).length,
            needsSync: comparisonData.filter(u => u.needsSync).length
        };

        console.log('🔄 Sync stats:', JSON.stringify(syncStats, null, 2));
        console.log('✅ ========== SCAN COMPLETE ==========');

        return Response.json({
            success: true,
            stats: stats,
            syncStats: syncStats,
            users: comparisonData,
            uniqueDepartments: Object.keys(stats.departments).sort(),
            tokenSource: tokenSource
        });

    } catch (error) {
        console.error('❌ ========== FATAL ERROR ==========');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to scan departments',
            details: error.message,
            errorType: error.constructor.name,
            users: []
        }, { status: 500 });
    }
});