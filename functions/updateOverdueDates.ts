import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify cron secret
    const url = new URL(req.url);
    const cronSecret = url.searchParams.get('secret');
    
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all tickets with due dates in the past that are not resolved or archived
    const allTickets = await base44.asServiceRole.entities.Ticket.list();
    
    const overdueTickets = allTickets.filter(ticket => {
      if (!ticket.due_date) return false;
      if (ticket.status === 'resolved' || ticket.status === 'archived') return false;
      
      const dueDate = new Date(ticket.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      return dueDate < today;
    });

    console.log(`Found ${overdueTickets.length} overdue tickets to update`);

    // Update each overdue ticket
    const updates = [];
    for (const ticket of overdueTickets) {
      const updateData = {
        due_date: today.toISOString().split('T')[0],
        last_activity_at: new Date().toISOString()
      };
      
      // Set original_due_date if not already set
      if (!ticket.original_due_date) {
        updateData.original_due_date = ticket.due_date;
      }
      
      const updatePromise = base44.asServiceRole.entities.Ticket.update(ticket.id, updateData);
      updates.push(updatePromise);
    }

    await Promise.all(updates);

    // Log execution
    await base44.asServiceRole.entities.CronExecutionLog.create({
      function_name: 'updateOverdueDates',
      status: 'success',
      trigger_source: 'Vercel Cron',
      events_checked: allTickets.length,
      mystery_resources_found: 0,
      new_requests_created: overdueTickets.length,
      emails_sent: 0,
      execution_time_ms: Date.now() - new Date(req.headers.get('x-vercel-cron-started') || Date.now()).getTime(),
      result_details: {
        tickets_updated: overdueTickets.length,
        ticket_ids: overdueTickets.map(t => t.id)
      }
    });

    return Response.json({
      success: true,
      tickets_updated: overdueTickets.length,
      updated_ticket_ids: overdueTickets.map(t => t.id)
    });

  } catch (error) {
    console.error('Error updating overdue dates:', error);
    
    // Log error
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.CronExecutionLog.create({
        function_name: 'updateOverdueDates',
        status: 'failed',
        trigger_source: 'Vercel Cron',
        error_message: error.message,
        error_stack: error.stack
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});