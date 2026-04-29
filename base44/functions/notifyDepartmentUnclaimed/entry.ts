import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Verify cron secret
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    
    // Calculate 8 hours ago
    const eightHoursAgo = new Date();
    eightHoursAgo.setHours(eightHoursAgo.getHours() - 8);
    
    // Get all unassigned tickets older than 8 hours
    const allTickets = await base44.asServiceRole.entities.Ticket.list('-created_date');
    
    const unclaimedTickets = allTickets.filter(ticket => {
      const createdDate = new Date(ticket.created_date);
      const isUnclaimed = !ticket.assigned_to;
      const isOldEnough = createdDate < eightHoursAgo;
      const isActive = ['open', 'awaiting_information', 'awaiting_parts'].includes(ticket.status);
      const isSupport = ['technology', 'cleaning', 'maintenance'].includes(ticket.category);
      
      return isUnclaimed && isOldEnough && isActive && isSupport;
    });

    console.log(`Found ${unclaimedTickets.length} unclaimed tickets older than 8 hours`);

    const notifications = [];
    
    // For each unclaimed ticket, notify the department
    for (const ticket of unclaimedTickets) {
      try {
        // Get users with ticket roles from Microsoft Groups
        const rolesResponse = await base44.asServiceRole.functions.invoke('getUsersWithTicketRoles');
        
        if (!rolesResponse.data.success) {
          console.error('Failed to get users with ticket roles');
          continue;
        }

        // Map category to department
        const getDepartment = (category) => {
          const deptMap = {
            'technology': 'IT',
            'cleaning': 'Facilities',
            'maintenance': 'Facilities'
          };
          return deptMap[category] || null;
        };

        const department = getDepartment(ticket.category);
        if (!department) continue;

        // Find all workers in this department
        const departmentWorkers = rolesResponse.data.allUsers.filter(user => 
          user.ticket_role === 'worker' && 
          user.departments && 
          user.departments.includes(department)
        );

        console.log(`Notifying ${departmentWorkers.length} workers in ${department} about ticket ${ticket.ticket_number}`);

        // Send notification to each worker in the department
        for (const worker of departmentWorkers) {
          try {
            await base44.asServiceRole.functions.invoke('createNotification', {
              user_email: worker.user_email,
              type: 'ticket_assigned',
              title: `Unclaimed Ticket: ${ticket.ticket_number}`,
              message: `${ticket.subject} - No one has claimed this ticket in 8 hours`,
              related_ticket_id: ticket.id,
              related_ticket_number: ticket.ticket_number,
              action_url: `/support-tickets?id=${ticket.id}`,
              send_email: true
            });
            
            notifications.push({
              ticket_id: ticket.id,
              worker_email: worker.user_email,
              status: 'sent'
            });
          } catch (error) {
            console.error(`Failed to notify ${worker.user_email}:`, error);
            notifications.push({
              ticket_id: ticket.id,
              worker_email: worker.user_email,
              status: 'failed',
              error: error.message
            });
          }
        }
      } catch (error) {
        console.error(`Error processing ticket ${ticket.ticket_number}:`, error);
      }
    }

    // Log execution
    await base44.asServiceRole.entities.CronExecutionLog.create({
      function_name: 'notifyDepartmentUnclaimed',
      status: 'success',
      trigger_source: 'Vercel Cron',
      events_checked: allTickets.length,
      mystery_resources_found: unclaimedTickets.length,
      emails_sent: notifications.filter(n => n.status === 'sent').length,
      execution_time_ms: Date.now() - new Date().getTime(),
      result_details: { notifications }
    });

    return Response.json({
      success: true,
      unclaimed_tickets: unclaimedTickets.length,
      notifications_sent: notifications.filter(n => n.status === 'sent').length,
      notifications_failed: notifications.filter(n => n.status === 'failed').length
    });

  } catch (error) {
    console.error('Error in notifyDepartmentUnclaimed:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});