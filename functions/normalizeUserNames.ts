import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Convert various name formats to "First Last" or just "First"
function normalizeName(name, email) {
  if (!name) {
    // Fall back to email prefix if no name
    const emailPrefix = email?.split('@')[0] || 'User';
    return normalizeFromEmailPrefix(emailPrefix);
  }

  // If it's already in "First Last" format (contains space, no dots/underscores)
  if (name.includes(' ') && !name.includes('.') && !name.includes('_')) {
    // Capitalize properly
    return name.split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle formats like "andy.milliorn" or "billy.nelms"
  if (name.includes('.')) {
    const parts = name.split('.');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle formats like "andy_milliorn"
  if (name.includes('_')) {
    const parts = name.split('_');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle single word names or usernames like "warrior7702"
  // Remove trailing numbers and capitalize
  const cleanName = name.replace(/\d+$/, '');
  if (cleanName.length > 0) {
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
  }

  return name;
}

function normalizeFromEmailPrefix(prefix) {
  // Handle email prefixes like "andy.milliorn" or "kyle.judkins"
  if (prefix.includes('.')) {
    const parts = prefix.split('.');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  if (prefix.includes('_')) {
    const parts = prefix.split('_');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  // Single word - just capitalize
  const cleanName = prefix.replace(/\d+$/, '');
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const { dryRun = true } = await req.json().catch(() => ({}));

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    const updates = [];
    const skipped = [];

    for (const u of allUsers) {
      const currentName = u.full_name;
      const normalizedName = normalizeName(currentName, u.email);

      if (currentName !== normalizedName) {
        updates.push({
          id: u.id,
          email: u.email,
          currentName: currentName || '(empty)',
          newName: normalizedName
        });

        if (!dryRun) {
          await base44.asServiceRole.entities.User.update(u.id, {
            full_name: normalizedName
          });
        }
      } else {
        skipped.push({
          email: u.email,
          name: currentName,
          reason: 'Already normalized'
        });
      }
    }

    return Response.json({
      success: true,
      dryRun,
      totalUsers: allUsers.length,
      updatedCount: updates.length,
      skippedCount: skipped.length,
      updates,
      skipped
    });

  } catch (error) {
    console.error('Error normalizing names:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});