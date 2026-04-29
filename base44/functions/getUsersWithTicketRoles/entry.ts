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

        if (!workerGroup) {
            console.warn('⚠️ OS_Ticket_Worker group not found!');
        }
        if (!adminGroup) {
            console.warn('⚠️ OS_Ticket_Admin group not found!');
        }

        // Process each user to get their group memberships
        const workers = [];
        const admins = [];
        const requesters = [];
        const departmentStats = {};
        const departmentList = new Set();
        let processedCount = 0;

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

                // Determine role (exact match, case-sensitive)
                const isAdmin = groupNames.includes('OS_Ticket_Admin');
                const isWorker = groupNames.includes('OS_Ticket_Worker');

                // Debug log for first few users
                if (processedCount < 3 || isWorker || isAdmin) {
                    console.log(`👤 User ${u.displayName}: Admin=${isAdmin}, Worker=${isWorker}, Groups=[${groupNames.join(', ')}]`);
                }
                
                // Get departments
                const userDepts = groupNames
                    .filter(name => name?.startsWith('Dept_'))
                    .map(name => name.replace('Dept_', ''));

                // Determine role: Admin > Worker > Requester (if has Dept_)
                let ticketRole = null;
                if (isAdmin) {
                    ticketRole = 'admin';
                } else if (isWorker) {
                    ticketRole = 'worker';
                } else if (userDepts.length > 0) {
                    ticketRole = 'requester';
                }

                // Skip users with no ticket system access
                if (!ticketRole) continue;

                const userInfo = {
                    id: u.id,
                    user_name: u.displayName,
                    user_email: u.mail || u.userPrincipalName,
                    ticket_role: ticketRole,
                    departments: userDepts,
                    department: userDepts.join(', ') || null,
                    groups: groupNames
                };

                // Categorize by primary role
                if (ticketRole === 'admin') {
                    admins.push(userInfo);
                } else if (ticketRole === 'worker') {
                    workers.push(userInfo);
                } else {
                    requesters.push(userInfo);
                }

                // Track department stats - count each user only once per department
                if (userDepts.length > 0) {
                    userDepts.forEach(dept => {
                        departmentList.add(dept);
                        
                        if (!departmentStats[dept]) {
                            departmentStats[dept] = {
                                workers: 0,
                                admins: 0,
                                requesters: 0,
                                total: 0
                            };
                        }
                        
                        // Count this user once for this department
                        departmentStats[dept].total++;
                        
                        if (isWorker) {
                            departmentStats[dept].workers++;
                        } else if (isAdmin) {
                            departmentStats[dept].admins++;
                        } else {
                            departmentStats[dept].requesters++;
                        }
                    });
                }

                processedCount++;

            } catch (error) {
                console.error(`Error processing user ${u.displayName}:`, error);
            }
        }

        const stats = {
            total: processedCount,
            workers: workers.length,
            admins: admins.length,
            requesters: requesters.length,
            departments: Array.from(departmentList).sort()
        };

        console.log('📊 Stats:', JSON.stringify(stats, null, 2));
        console.log('📊 Departments found:', Array.from(departmentList).sort());
        console.log('📊 Department breakdown:', JSON.stringify(departmentStats, null, 2));

        return Response.json({
            success: true,
            stats: stats,
            workers: workers,
            viewers: admins,
            requesters: requesters,
            departmentStats: departmentStats,
            departmentList: Array.from(departmentList).sort(),
            allUsers: [...workers, ...admins, ...requesters],
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