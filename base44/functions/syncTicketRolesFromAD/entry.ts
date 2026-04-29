import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('🎫 ========== TICKET ROLE SYNC STARTED ==========');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin' && user.role !== 'super_user') {
            return Response.json({ 
                error: 'Forbidden - Admin access required' 
            }, { status: 403 });
        }

        // Get access token
        let accessToken = user.microsoft_access_token;
        let tokenSource = 'Manual';
        
        if (!accessToken) {
            try {
                const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
                if (ssoToken) {
                    accessToken = ssoToken.trim().replace('Bearer ', '').replace(/\s/g, '');
                    tokenSource = 'SSO';
                }
            } catch (error) {
                console.error('SSO token error:', error);
            }
        }
        
        if (!accessToken) {
            return Response.json({
                success: false,
                error: 'Microsoft 365 not connected'
            }, { status: 400 });
        }

        console.log(`✅ Using token from: ${tokenSource}`);

        // Get all users with their groups
        console.log('📡 Fetching users and their groups...');
        const usersResponse = await fetch(
            'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department&$top=999',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!usersResponse.ok) {
            const errorText = await usersResponse.text();
            console.error('❌ Graph API error:', errorText);
            return Response.json({
                success: false,
                error: 'Failed to fetch users from Microsoft'
            }, { status: usersResponse.status });
        }

        const usersData = await usersResponse.json();
        const users = usersData.value || [];
        console.log(`✅ Retrieved ${users.length} users`);

        const results = {
            processed: 0,
            updated: 0,
            created: 0,
            removed: 0,
            errors: [],
            details: []
        };

        // Process each user
        for (const adUser of users) {
            try {
                results.processed++;
                const email = adUser.mail || adUser.userPrincipalName;
                
                console.log(`\n👤 Processing: ${adUser.displayName} (${email})`);

                // Get user's groups
                const groupsResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${adUser.id}/memberOf?$select=id,displayName`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!groupsResponse.ok) {
                    console.warn(`⚠️ Failed to get groups for ${email}`);
                    results.errors.push(`Failed to get groups for ${email}`);
                    continue;
                }

                const groupsData = await groupsResponse.json();
                const groups = (groupsData.value || []).map(g => g.displayName);
                
                console.log(`   Groups: ${groups.join(', ')}`);

                // Check for ticket role groups
                const isAdmin = groups.includes('OS_Ticket_Admin');
                const isWorker = groups.includes('OS_Ticket_Worker');
                
                // Get department from Dept_* groups
                const deptGroups = groups.filter(g => g.startsWith('Dept_'));
                const department = deptGroups.length > 0 
                    ? deptGroups[0].replace('Dept_', '') 
                    : (adUser.department || null);

                console.log(`   Is Admin: ${isAdmin}, Is Worker: ${isWorker}`);
                console.log(`   Department: ${department}`);

                // Check existing ticket role
                const existingRoles = await base44.asServiceRole.entities.TicketRoleAssignment.filter({
                    user_email: email
                });

                if (!isWorker && !isAdmin) {
                    // Remove ticket role if exists
                    if (existingRoles.length > 0) {
                        for (const role of existingRoles) {
                            await base44.asServiceRole.entities.TicketRoleAssignment.delete(role.id);
                        }
                        results.removed++;
                        console.log(`   ✅ Removed ticket role (no longer in AD groups)`);
                    }
                    continue;
                }

                // Determine ticket role
                const ticketRole = isWorker ? 'worker' : 'viewer';

                if (existingRoles.length > 0) {
                    // Update existing
                    const existing = existingRoles[0];
                    let needsUpdate = false;
                    const updates = {};

                    if (existing.ticket_role !== ticketRole) {
                        updates.ticket_role = ticketRole;
                        needsUpdate = true;
                    }

                    if (existing.department !== department) {
                        updates.department = department;
                        needsUpdate = true;
                    }

                    if (existing.user_name !== adUser.displayName) {
                        updates.user_name = adUser.displayName;
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        await base44.asServiceRole.entities.TicketRoleAssignment.update(
                            existing.id,
                            updates
                        );
                        results.updated++;
                        console.log(`   ✅ Updated: ${ticketRole} - ${department}`);
                    } else {
                        console.log(`   ✓ No changes needed`);
                    }

                    // Remove duplicates if any
                    if (existingRoles.length > 1) {
                        for (let i = 1; i < existingRoles.length; i++) {
                            await base44.asServiceRole.entities.TicketRoleAssignment.delete(existingRoles[i].id);
                        }
                        console.log(`   🗑️ Removed ${existingRoles.length - 1} duplicate(s)`);
                    }
                } else {
                    // Create new
                    await base44.asServiceRole.entities.TicketRoleAssignment.create({
                        user_email: email,
                        user_name: adUser.displayName,
                        ticket_role: ticketRole,
                        department: department
                    });
                    results.created++;
                    console.log(`   ✅ Created: ${ticketRole} - ${department}`);
                }

                results.details.push({
                    email: email,
                    name: adUser.displayName,
                    ticketRole: ticketRole,
                    department: department,
                    groups: groups
                });

            } catch (error) {
                console.error(`❌ Error processing ${adUser.displayName}:`, error.message);
                results.errors.push(`${adUser.displayName}: ${error.message}`);
            }
        }

        console.log('\n📊 ========== SYNC SUMMARY ==========');
        console.log(`   Processed: ${results.processed}`);
        console.log(`   Created: ${results.created}`);
        console.log(`   Updated: ${results.updated}`);
        console.log(`   Removed: ${results.removed}`);
        console.log(`   Errors: ${results.errors.length}`);
        console.log('✅ ========== SYNC COMPLETE ==========');

        return Response.json({
            success: true,
            ...results,
            tokenSource: tokenSource
        });

    } catch (error) {
        console.error('❌ ========== FATAL ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to sync ticket roles',
            details: error.message
        }, { status: 500 });
    }
});