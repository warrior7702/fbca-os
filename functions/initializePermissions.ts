import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const permissions = [
      // Tickets
      { code: 'tickets.view', name: 'View Tickets', description: 'View all tickets', category: 'tickets' },
      { code: 'tickets.create', name: 'Create Tickets', description: 'Create new tickets', category: 'tickets' },
      { code: 'tickets.update', name: 'Update Tickets', description: 'Edit and update tickets', category: 'tickets' },
      { code: 'tickets.assign', name: 'Assign Tickets', description: 'Assign tickets to users', category: 'tickets' },
      { code: 'tickets.delete', name: 'Delete Tickets', description: 'Delete tickets', category: 'tickets' },
      
      // Communications
      { code: 'comms.view', name: 'View Communications', description: 'View communication requests', category: 'communications' },
      { code: 'comms.create', name: 'Create Communications', description: 'Create communication requests', category: 'communications' },
      { code: 'comms.manage', name: 'Manage Communications', description: 'Manage and process requests', category: 'communications' },
      
      // Users
      { code: 'users.view', name: 'View Users', description: 'View user list', category: 'users' },
      { code: 'users.manage', name: 'Manage Users', description: 'Edit users and assign roles', category: 'users' },
      { code: 'users.delete', name: 'Delete Users', description: 'Delete user accounts', category: 'users' },
      
      // Settings
      { code: 'settings.view', name: 'View Settings', description: 'Access settings page', category: 'settings' },
      { code: 'settings.manage', name: 'Manage Settings', description: 'Modify system settings', category: 'settings' },
      { code: 'settings.integrations', name: 'Manage Integrations', description: 'Configure integrations', category: 'settings' },
      
      // System
      { code: 'system.admin', name: 'System Admin', description: 'Full system access', category: 'system' },
      { code: 'system.roles', name: 'Manage Roles', description: 'Create and manage roles', category: 'system' }
    ];

    // Create permissions
    let created = 0;
    for (const perm of permissions) {
      const existing = await base44.asServiceRole.entities.Permission.filter({ code: perm.code });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Permission.create(perm);
        created++;
      }
    }

    // Create default roles if they don't exist
    const roles = [
      {
        name: 'Super Admin',
        description: 'Full system access',
        is_system: true,
        permissions: permissions.map(p => p.code)
      },
      {
        name: 'Support Manager',
        description: 'Manage support tickets and users',
        is_system: false,
        permissions: ['tickets.view', 'tickets.create', 'tickets.update', 'tickets.assign', 'users.view']
      },
      {
        name: 'Support Worker',
        description: 'Work on assigned tickets',
        is_system: false,
        permissions: ['tickets.view', 'tickets.update']
      }
    ];

    let rolesCreated = 0;
    for (const role of roles) {
      const existing = await base44.asServiceRole.entities.Role.filter({ name: role.name });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Role.create(role);
        rolesCreated++;
      }
    }

    return Response.json({ 
      success: true,
      permissions_created: created,
      roles_created: rolesCreated,
      total_permissions: permissions.length
    });

  } catch (error) {
    console.error('Error initializing permissions:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});