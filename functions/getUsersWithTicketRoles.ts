import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔍 Fetching users with ticket roles...');
        console.log('   User:', user.email);

        // Get Microsoft access token - SSO FIRST (it has permissions now!)
        let accessToken = null;
        let tokenSource = null;

        // Try SSO first (now has User.Read.All!)
        try {
            const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
            if (ssoToken) {
                let cleanToken = ssoToken.trim();
                if (cleanToken.startsWith('Bearer ')) {
                    cleanToken = cleanToken.substring(7);
                }
                cleanToken = cleanToken.replace(/\s/g, '');
                
                if (cleanToken.split('.').length === 3) {
                    accessToken = cleanToken;
                    tokenSource = 'SSO';
                    console.log('✅ Using SSO token');
                }
            }
        } catch (ssoError) {
            console.log('⚠️ SSO not available, trying manual...');
        }

        // Fallback to manual token
        if (!accessToken && user.microsoft_access_token) {
            accessToken = user.microsoft_access_token.trim();
            tokenSource = 'Manual';
            console.log('✅ Using manual token');
        }

        if (!accessToken) {
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected',
                details: 'Please connect Microsoft 365 in Settings.',
                users: []
            }, { status: 400 });
        }

        console.log(`🔑 Token source: ${tokenSource}`);

        // Fetch users with BOTH cloud and on-prem extension attributes
        // For hybrid AD: onPremisesExtensionAttributes contains synced on-prem attributes
        const graphUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,onPremisesExtensionAttributes&$top=999';
        
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Graph API error:', response.status, errorText);
            
            return Response.json({
                success: false,
                error: `Graph API error: ${response.status}`,
                details: errorText,
                users: []
            }, { status: response.status });
        }

        const data = await response.json();
        const allUsers = data.value || [];

        console.log(`✅ Retrieved ${allUsers.length} users from Microsoft`);

        // Parse and categorize users based on extension attributes
        // HYBRID AD SETUP:
        // - onPremisesExtensionAttributes.extensionAttribute1 = OSTicketRole → "worker" or "viewer"
        // - onPremisesExtensionAttributes.extensionAttribute2 = OSDept → "Admin", "Kitchen", "Comms", etc.
        // These attributes are synced from on-prem AD to Entra ID via Azure AD Connect
        
        const workers = [];
        const viewers = [];
        const uncategorized = [];
        const departmentStats = {};
        const roleStats = { worker: 0, viewer: 0, noRole: 0 };
        const departmentList = new Set();
        const attributeSources = { onPrem: 0, cloud: 0, both: 0, neither: 0 };

        allUsers.forEach(u => {
            // Check on-premises extension attributes (synced from local AD)
            const onPremExtAttrs = u.onPremisesExtensionAttributes || {};
            
            // Extract values - normalize role to lowercase
            const osTicketRole = onPremExtAttrs.extensionAttribute1?.toLowerCase()?.trim();
            const osDept = onPremExtAttrs.extensionAttribute2?.trim();

            // Track where attributes are coming from
            const hasOnPremRole = !!onPremExtAttrs.extensionAttribute1;
            const hasOnPremDept = !!onPremExtAttrs.extensionAttribute2;
            
            if (hasOnPremRole || hasOnPremDept) {
                attributeSources.onPrem++;
            } else {
                attributeSources.neither++;
            }

            const userInfo = {
                id: u.id,
                displayName: u.displayName,
                email: u.mail || u.userPrincipalName,
                department: u.department, // O365 department field (different from OSDept)
                jobTitle: u.jobTitle,
                osTicketRole: osTicketRole || null,
                osDept: osDept || null,
                hasTicketRole: !!osTicketRole,
                hasDepartment: !!osDept,
                hasExtensionData: !!(osTicketRole || osDept),
                attributeSource: (hasOnPremRole || hasOnPremDept) ? 'On-Premises (synced)' : 'None'
            };

            // Log first few users for debugging
            if (allUsers.indexOf(u) < 3) {
                console.log('🔍 Sample user:', {
                    name: u.displayName,
                    email: u.mail || u.userPrincipalName,
                    onPremExtAttrs: onPremExtAttrs,
                    parsed: {
                        osTicketRole: osTicketRole,
                        osDept: osDept
                    }
                });
            }

            // Categorize by role
            if (osTicketRole === 'worker') {
                roleStats.worker++;
                workers.push(userInfo);
            } else if (osTicketRole === 'viewer') {
                roleStats.viewer++;
                viewers.push(userInfo);
            } else {
                roleStats.noRole++;
                uncategorized.push(userInfo);
            }

            // Track department stats (independent of role)
            if (osDept) {
                departmentList.add(osDept);
                
                if (!departmentStats[osDept]) {
                    departmentStats[osDept] = {
                        workers: 0,
                        viewers: 0,
                        noRole: 0,
                        total: 0
                    };
                }
                departmentStats[osDept].total++;
                
                if (osTicketRole === 'worker') {
                    departmentStats[osDept].workers++;
                } else if (osTicketRole === 'viewer') {
                    departmentStats[osDept].viewers++;
                } else {
                    departmentStats[osDept].noRole++;
                }
            }
        });

        const stats = {
            total: allUsers.length,
            workers: workers.length,
            viewers: viewers.length,
            uncategorized: uncategorized.length,
            withExtensionData: allUsers.filter(u => {
                const ext = u.onPremisesExtensionAttributes || {};
                return !!(ext.extensionAttribute1 || ext.extensionAttribute2);
            }).length,
            withTicketRole: roleStats.worker + roleStats.viewer,
            withDepartment: Array.from(departmentList).length > 0 ? 
                Object.values(departmentStats).reduce((sum, dept) => sum + dept.total, 0) : 0,
            departments: Array.from(departmentList).sort()
        };

        console.log('📊 Stats:', JSON.stringify(stats, null, 2));
        console.log('📊 Role breakdown:', JSON.stringify(roleStats, null, 2));
        console.log('📊 Departments found:', Array.from(departmentList).sort());
        console.log('📊 Attribute sources:', JSON.stringify(attributeSources, null, 2));

        return Response.json({
            success: true,
            tokenSource: tokenSource,
            stats: stats,
            roleStats: roleStats,
            attributeSources: attributeSources,
            workers: workers,
            viewers: viewers,
            uncategorized: uncategorized,
            departmentStats: departmentStats,
            departmentList: Array.from(departmentList).sort(),
            setupInfo: {
                type: 'Hybrid AD (Azure AD Connect)',
                extensionAttribute1: 'OSTicketRole (worker/viewer)',
                extensionAttribute2: 'OSDept (Admin/Kitchen/Comms/etc.)',
                syncedFrom: 'On-Premises Active Directory → Entra ID',
                apiField: 'onPremisesExtensionAttributes'
            },
            allUsers: allUsers.map(u => {
                const ext = u.onPremisesExtensionAttributes || {};
                return {
                    id: u.id,
                    displayName: u.displayName,
                    email: u.mail || u.userPrincipalName,
                    department: u.department,
                    jobTitle: u.jobTitle,
                    osTicketRole: ext.extensionAttribute1?.toLowerCase()?.trim() || null,
                    osDept: ext.extensionAttribute2?.trim() || null,
                    rawOnPremExtensionAttributes: ext, // Full raw data for debugging
                    attributeSource: (ext.extensionAttribute1 || ext.extensionAttribute2) ? 'On-Premises (synced)' : 'None'
                };
            })
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({
            success: false,
            error: 'Failed to fetch users with ticket roles',
            details: error.message,
            users: []
        }, { status: 500 });
    }
});