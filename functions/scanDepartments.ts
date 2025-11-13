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

        // Try SSO token first
        let accessToken = null;
        try {
            accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            if (accessToken) {
                console.log('✅ Using SSO token');
            }
        } catch (ssoError) {
            console.log('⚠️ SSO error:', ssoError.message);
        }
        
        // Fall back to manual token
        if (!accessToken && user.microsoft_access_token) {
            accessToken = user.microsoft_access_token;
            console.log('✅ Using manual token');
        }
        
        if (!accessToken) {
            console.error('❌ No Microsoft access token');
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                needsConnection: true,
                users: []
            }, { status: 400 });
        }

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
                return Response.json({
                    success: false,
                    error: 'Microsoft token expired',
                    needsReconnection: true,
                    users: []
                }, { status: 401 });
            }
            
            if (response.status === 403) {
                return Response.json({
                    success: false,
                    error: 'Insufficient permissions',
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
            uniqueDepartments: Object.keys(stats.departments).sort()
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