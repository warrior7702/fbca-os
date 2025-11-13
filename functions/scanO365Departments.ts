import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ 
                error: 'Unauthorized - Please log in' 
            }, { status: 401 });
        }

        if (user.role !== 'admin' && user.role !== 'super_user') {
            return Response.json({ 
                error: 'Forbidden - Admin access required' 
            }, { status: 403 });
        }

        console.log('🔍 ========== SCANNING O365 DEPARTMENTS ==========');
        console.log('👤 Admin user:', user.email, '| Role:', user.role);

        // Try to get Microsoft access token
        let accessToken = null;
        
        // Try SSO token first (for users logged in via Microsoft SSO)
        try {
            accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            if (accessToken) {
                console.log('✅ Using SSO token');
            }
        } catch (ssoError) {
            console.log('ℹ️ No SSO token available:', ssoError.message);
        }
        
        // Fall back to manually connected Microsoft token
        if (!accessToken && user.microsoft_access_token) {
            accessToken = user.microsoft_access_token;
            console.log('✅ Using manually connected Microsoft token');
        }
        
        if (!accessToken) {
            console.error('❌ No Microsoft access token available');
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                details: 'Please connect Microsoft 365 in Settings, or log in via Microsoft SSO.',
                needsConnection: true,
                users: []
            }, { status: 400 });
        }

        console.log('✅ Got Microsoft access token');

        // Call Microsoft Graph API to get all users
        const graphUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation,companyName,employeeId&$top=999';
        
        console.log('📡 Calling Microsoft Graph API...');
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Microsoft Graph API error:', response.status, errorText);
            
            // Handle specific error cases
            if (response.status === 401) {
                return Response.json({
                    success: false,
                    error: 'Microsoft token expired or invalid',
                    details: 'Please reconnect Microsoft 365 in Settings.',
                    needsReconnection: true,
                    users: []
                }, { status: 401 });
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
                error: `Microsoft Graph API error: ${response.status}`,
                details: errorText,
                users: []
            }, { status: response.status });
        }

        const data = await response.json();
        const o365Users = data.value || [];

        console.log(`✅ Retrieved ${o365Users.length} users from Microsoft 365`);

        // Analyze department data
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

        console.log('\n📊 ========== O365 DEPARTMENT STATS ==========');
        console.log(`Total Users: ${stats.total}`);
        console.log(`✅ With Department: ${stats.withDepartment} (${Math.round(stats.withDepartment / stats.total * 100)}%)`);
        console.log(`❌ Without Department: ${stats.withoutDepartment} (${Math.round(stats.withoutDepartment / stats.total * 100)}%)`);
        console.log(`✅ With Job Title: ${stats.withJobTitle} (${Math.round(stats.withJobTitle / stats.total * 100)}%)`);
        console.log(`❌ Without Job Title: ${stats.withoutJobTitle} (${Math.round(stats.withoutJobTitle / stats.total * 100)}%)`);
        
        console.log('\n📂 Departments Found:');
        Object.entries(stats.departments)
            .sort((a, b) => b[1] - a[1])
            .forEach(([dept, count]) => {
                console.log(`  - ${dept}: ${count} users`);
            });

        // Get Base44 users for comparison
        console.log('\n📊 Loading Base44 users for comparison...');
        const base44Users = await base44.asServiceRole.entities.User.list();
        
        console.log(`✅ Retrieved ${base44Users.length} users from Base44`);

        // Compare and merge data
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

        console.log('\n🔄 ========== SYNC STATUS ==========');
        console.log(`✅ Users in both systems: ${syncStats.inBothSystems}`);
        console.log(`⚠️  Users only in O365: ${syncStats.notInBase44}`);
        console.log(`✅ Department data matches: ${syncStats.departmentMatches}`);
        console.log(`🔄 Needs sync: ${syncStats.needsSync}`);

        return Response.json({
            success: true,
            stats: stats,
            syncStats: syncStats,
            users: comparisonData,
            uniqueDepartments: Object.keys(stats.departments).sort()
        });

    } catch (error) {
        console.error('\n❌ ========== SCAN ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to scan O365 departments',
            details: error.message,
            users: []
        }, { status: 500 });
    }
});