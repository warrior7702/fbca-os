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

        console.log('🔑 Getting Microsoft access token...');
        console.log('   User email domain:', user.email?.split('@')[1]);
        console.log('   Has manual token:', !!user.microsoft_access_token);

        // IMPORTANT: Try SSO token FIRST (for users logged in via Microsoft SSO)
        let accessToken = null;
        let tokenSource = null;
        
        try {
            console.log('🔐 Attempting SSO token...');
            accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            if (accessToken) {
                tokenSource = 'SSO';
                console.log('✅ Using SSO token (length:', accessToken.length, ')');
            } else {
                console.log('ℹ️ SSO token returned null');
            }
        } catch (ssoError) {
            console.log('⚠️ SSO error:', ssoError.message);
        }
        
        // Only use manual token if SSO failed AND user has one
        if (!accessToken && user.microsoft_access_token) {
            accessToken = user.microsoft_access_token;
            tokenSource = 'Manual';
            console.log('⚠️ Falling back to manual token (length:', accessToken.length, ')');
            
            // Validate token format
            if (!accessToken.includes('.')) {
                console.error('❌ Token appears malformed (no JWT structure)');
                return Response.json({
                    success: false,
                    error: 'Microsoft token is corrupted',
                    details: 'Your manually connected Microsoft token is invalid. Please disconnect and reconnect Microsoft 365 in Settings, or use Microsoft SSO login.',
                    needsReconnection: true,
                    users: []
                }, { status: 400 });
            }
        }
        
        if (!accessToken) {
            console.error('❌ No Microsoft access token available');
            console.log('🔍 Debug info:');
            console.log('  - User email domain:', user.email?.split('@')[1]);
            console.log('  - Has microsoft_access_token:', !!user.microsoft_access_token);
            console.log('  - SSO available:', false);
            
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                details: 'Please log in with Microsoft SSO, or connect Microsoft 365 manually in Settings.',
                needsConnection: true,
                users: []
            }, { status: 400 });
        }

        console.log(`🔑 Using token from: ${tokenSource}`);

        // Call Microsoft Graph API
        console.log('📡 Calling Microsoft Graph API...');
        const graphUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation,companyName,employeeId&$top=999';
        
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📥 Graph API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Graph API error:', response.status, errorText);
            
            if (response.status === 401) {
                if (tokenSource === 'Manual') {
                    return Response.json({
                        success: false,
                        error: 'Microsoft token expired or invalid',
                        details: 'Your manually connected Microsoft token is no longer valid. Please disconnect and reconnect Microsoft 365 in Settings, or use Microsoft SSO login.',
                        needsReconnection: true,
                        tokenSource: tokenSource,
                        users: []
                    }, { status: 401 });
                } else {
                    return Response.json({
                        success: false,
                        error: 'SSO token expired',
                        details: 'Your SSO session expired. Please log out and log back in.',
                        needsRelogin: true,
                        tokenSource: tokenSource,
                        users: []
                    }, { status: 401 });
                }
            }
            
            if (response.status === 403) {
                return Response.json({
                    success: false,
                    error: 'Insufficient permissions',
                    details: 'Your Microsoft account needs User.Read.All or Directory.Read.All permissions to scan all users.',
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

        console.log('📊 Stats:', stats);

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

        console.log('🔄 Sync stats:', syncStats);
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
        console.error('❌ ========== ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to scan departments',
            details: error.message,
            users: []
        }, { status: 500 });
    }
});