import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { permission_code } = await req.json();

    if (!permission_code) {
      return Response.json({ error: 'permission_code required' }, { status: 400 });
    }

    // Super users have all permissions
    if (user.role === 'super_user') {
      return Response.json({ 
        has_permission: true,
        reason: 'super_user'
      });
    }

    // Get user's roles
    const userRoles = await base44.asServiceRole.entities.UserRole.filter({
      user_email: user.email
    });

    if (userRoles.length === 0) {
      return Response.json({ 
        has_permission: false,
        reason: 'no_roles'
      });
    }

    // Get all roles and check permissions
    const roleIds = userRoles.map(ur => ur.role_id);
    const roles = await base44.asServiceRole.entities.Role.filter({
      id: { $in: roleIds }
    });

    // Check if any role has the permission
    const hasPermission = roles.some(role => 
      role.permissions && role.permissions.includes(permission_code)
    );

    return Response.json({ 
      has_permission: hasPermission,
      roles: roles.map(r => r.name)
    });

  } catch (error) {
    console.error('Error checking permission:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});