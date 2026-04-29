import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate the caller
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized - please login' 
      }, { status: 401 });
    }

    console.log('👤 Caller:', caller.email, 'Role:', caller.role);

    // Get request body
    const { user_id, role } = await req.json();

    if (!user_id || !role) {
      return Response.json({ 
        success: false, 
        error: 'Missing user_id or role' 
      }, { status: 400 });
    }

    // Validate role value
    const validRoles = ['user', 'admin', 'super_user'];
    if (!validRoles.includes(role)) {
      return Response.json({ 
        success: false, 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      }, { status: 400 });
    }

    // Check permissions
    // Only admins and super_users can change roles
    if (caller.role !== 'admin' && caller.role !== 'super_user') {
      return Response.json({ 
        success: false, 
        error: 'Only admins and super users can change user roles' 
      }, { status: 403 });
    }

    // Super users can do anything
    // Admins can change roles but cannot create other super_users (only super_user can do that)
    if (caller.role === 'admin' && role === 'super_user') {
      return Response.json({ 
        success: false, 
        error: 'Only super users can grant super_user role' 
      }, { status: 403 });
    }

    console.log('✅ Permission check passed');
    console.log('🔄 Updating user', user_id, 'to role:', role);

    // Use service role to update the user
    await base44.asServiceRole.entities.User.update(user_id, { role });

    console.log('✅ Role updated successfully!');

    return Response.json({ 
      success: true, 
      message: `User role updated to ${role}` 
    });

  } catch (error) {
    console.error('❌ Error updating user role:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to update user role',
      details: error.toString()
    }, { status: 500 });
  }
});