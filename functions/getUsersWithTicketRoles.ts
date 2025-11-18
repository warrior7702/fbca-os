import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔍 Fetching users and their security group memberships...');

        // Get SSO token
        const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
        if (!ssoToken) {
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                details: 'Please connect Microsoft 365 in Settings.',
                users: []
            }, { status: 400 });
        }

        // Fetch all users
        const usersResponse = await fetch(
            'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999',
            {
                headers: {
                    'Authorization': ssoToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!usersResponse.ok) {
            const errorText = await usersResponse.text();
            console.error('❌ Graph API error:', usersResponse.status, errorText);
            return Response.json({
                success: false,
                error: `Graph API error: ${usersResponse.status}`,
                details: errorText,
                users: []
            }, { status: usersResponse.status });
        }

        const usersData = await usersResponse.json();
        const allUsers = usersData.value || [];
        console.log(`✅ Retrieved ${allUsers.length} users from Microsoft`);

        // Fetch all security groups
        const groupsResponse = await fetch(
            'https://graph.microsoft.com/v1.0/groups?$select=id,displayName&$top=999',
            {
                headers: {
                    'Authorization': ssoToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        const groupsData = await groupsResponse.json();
        const allGroups = groupsData.value || [];
        
        // Find our special groups
        const workerGroup = allGroups.find(g => g.displayName === 'OS_Ticket_Worker');
        const adminGroup = allGroups.find(g => g.displayName === 'OS_Ticket_Admin');
        const deptGroups = allGroups.filter(g => g.displayName?.startsWith('Dept_'));

        console.log('🔍 Found groups:', {
            workerGroup: workerGroup?.displayName,
            adminGroup: adminGroup?.displayName,
            deptGroups: deptGroups.map(g => g.displayName)
        });

        // Process each user to get their group memberships
        const workers = [];
        const viewers = [];
        const requesters = [];
        const departmentStats = {};
        const departmentList = new Set();

        for (const u of allUsers) {
            try {
                // Get user's group memberships
                const memberOfResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${u.id}/memberOf?$select=id,displayName`,
                    {
                        headers: {
                            'Authorization': ssoToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!memberOfResponse.ok) continue;

                const memberOfData = await memberOfResponse.json();
                const userGroups = memberOfData.value || [];
                const groupNames = userGroups.map(g => g.displayName);

                // Determine role
                const isWorker = groupNames.includes('OS_Ticket_Worker');
                const isAdmin = groupNames.includes('OS_Ticket_Admin');
                
                // Get departments
                const userDepts = groupNames
                    .filter(name => name?.startsWith('Dept_'))
                    .map(name => name.replace('Dept_', ''));

                const userInfo = {
                    id: u.id,
                    user_name: u.displayName,
                    user_email: u.mail || u.userPrincipalName,
                    ticket_role: isWorker ? 'worker' : (isAdmin ? 'admin' : 'requester'),
                    departments: userDepts,
                    department: userDepts.join(', ') || null,
                    groups: groupNames
                };

                // Categorize
                if (isWorker) {
                    workers.push(userInfo);
                } else if (isAdmin) {
                    viewers.push(userInfo);
                } else {
                    requesters.push(userInfo);
                }

                // Track departments
                userDepts.forEach(dept => {
                    departmentList.add(dept);
                    
                    if (!departmentStats[dept]) {
                        departmentStats[dept] = {
                            workers: 0,
                            viewers: 0,
                            total: 0
                        };
                    }
                    
                    departmentStats[dept].total++;
                    
                    if (isWorker) {
                        departmentStats[dept].workers++;
                    } else if (isAdmin) {
                        departmentStats[dept].viewers++;
                    }
                });

            } catch (error) {
                console.error(`Error processing user ${u.displayName}:`, error);
            }
        }

        const stats = {
            total: allUsers.length,
            workers: workers.length,
            viewers: viewers.length,
            requesters: requesters.length,
            departments: Array.from(departmentList).sort()
        };

        console.log('📊 Stats:', JSON.stringify(stats, null, 2));
        console.log('📊 Departments found:', Array.from(departmentList).sort());

        return Response.json({
            success: true,
            stats: stats,
            workers: workers,
            viewers: viewers,
            requesters: requesters,
            departmentStats: departmentStats,
            departmentList: Array.from(departmentList).sort(),
            allUsers: [...workers, ...viewers, ...requesters],
            groupsFound: {
                workerGroup: !!workerGroup,
                adminGroup: !!adminGroup,
                deptGroups: deptGroups.length
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({
            success: false,
            error: 'Failed to fetch ticket roles from security groups',
            details: error.message,
            scopeNote: 'Ensure GroupMember.Read.All is added to SSO scope',
            users: []
        }, { status: 500 });
    }
});