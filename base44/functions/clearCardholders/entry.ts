import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication - only admins can clear the database
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'super_user') {
      return Response.json({ 
        error: 'Only admins can clear the cardholder database' 
      }, { status: 403 });
    }

    console.log('🗑️ Clearing all cardholders...');

    // Get all cardholders
    const allCardholders = await base44.asServiceRole.entities.Cardholder.list();
    
    console.log(`Found ${allCardholders.length} cardholders to delete`);

    // Delete them all
    let deleted = 0;
    for (const cardholder of allCardholders) {
      await base44.asServiceRole.entities.Cardholder.delete(cardholder.id);
      deleted++;
    }

    console.log(`✅ Deleted ${deleted} cardholders`);

    return Response.json({
      ok: true,
      message: `Successfully deleted ${deleted} cardholders`,
      deleted: deleted
    });

  } catch (error) {
    console.error('❌ Clear cardholders error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});