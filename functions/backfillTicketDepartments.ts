import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all tickets
    const allTickets = await base44.asServiceRole.entities.Ticket.list();
    
    // Filter tickets missing assigned_department (and have scope to avoid validation errors)
    const ticketsToUpdate = allTickets.filter(t => 
      !t.assigned_department && 
      t.category && 
      t.scope // Only update tickets with scope field to avoid validation errors
    );
    
    console.log(`Found ${ticketsToUpdate.length} tickets missing assigned_department`);
    
    let updatedCount = 0;
    const results = {
      total: ticketsToUpdate.length,
      updated: 0,
      skipped: 0,
      byDepartment: {
        IT: 0,
        Facilities: 0
      }
    };
    
    for (const ticket of ticketsToUpdate) {
      let department = null;
      
      // Map category to department
      if (ticket.category === 'technology') {
        department = 'IT';
      } else if (ticket.category === 'maintenance' || ticket.category === 'cleaning') {
        department = 'Facilities';
      }
      
      if (department) {
        await base44.asServiceRole.entities.Ticket.update(ticket.id, {
          assigned_department: department,
          assigned_department_reason: 'Backfilled from category'
        });
        
        updatedCount++;
        results.byDepartment[department]++;
        console.log(`Updated ticket ${ticket.ticket_number}: ${department}`);
      } else {
        results.skipped++;
        console.log(`Skipped ticket ${ticket.ticket_number}: no category mapping`);
      }
    }
    
    results.updated = updatedCount;
    
    console.log('Backfill complete:', results);
    
    return Response.json({
      success: true,
      message: `Successfully backfilled ${updatedCount} tickets`,
      results
    });
    
  } catch (error) {
    console.error('Error backfilling departments:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});