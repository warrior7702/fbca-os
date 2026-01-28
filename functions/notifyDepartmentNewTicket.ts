import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return Response.json({ success: false, error: 'ticket_id required' }, { status: 400 });
    }

    // Fetch the ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticket_id);
    
    if (!ticket) {
      return Response.json({ 
        success: false, 
        error: 'Ticket not found' 
      }, { status: 404 });
    }

    // Map category to department if assigned_department is not set
    const categoryToDept = {
      'technology': 'IT',
      'cleaning': 'Facilities',
      'maintenance': 'Facilities'
    };
    
    const department = ticket.assigned_department || categoryToDept[ticket.category];
    
    if (!department) {
      return Response.json({ 
        success: false, 
        error: 'No department could be determined from ticket' 
      }, { status: 400 });
    }

    // Get all workers in this department
    const roleAssignments = await base44.asServiceRole.entities.TicketRoleAssignment.filter({
      ticket_role: 'worker',
      department: department
    });

    const workerEmails = roleAssignments.map(r => r.user_email);
    
    if (workerEmails.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No workers found in department',
        notified: 0 
      });
    }

    const ticketUrl = `${Deno.env.get('BASE44_APP_URL')}/TicketDetail?id=${ticket.id}`;
    const message = `🎫 New ${ticket.priority || 'medium'} priority ticket created\n\n*${ticket.ticket_number}: ${ticket.subject}*\n\nClick to view/claim: ${ticketUrl}`;

    let teamsMessagesSent = 0;
    let notificationsCreated = 0;
    let emailsSent = 0;

    // Notify each worker
    for (const email of workerEmails) {
      // Create in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title: `New Ticket: ${ticket.ticket_number}`,
        message: `${ticket.priority} priority - ${ticket.subject}`,
        type: 'ticket_created',
        action_url: `/TicketDetail?id=${ticket.id}`,
        read: false
      });
      notificationsCreated++;

      // Send Teams message via Spark bot
      try {
        await base44.asServiceRole.functions.invoke('sendTeamsMessage', {
          recipient_email: email,
          message: message
        });
        teamsMessagesSent++;
      } catch (error) {
        console.error(`Failed to send Teams message to ${email}:`, error);
      }

      // Check if user wants email notifications
      try {
        const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
          user_email: email
        });
        
        const userPref = prefs[0];
        if (userPref?.ticket_created_email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `New Ticket: ${ticket.ticket_number}`,
            body: `
              <h2>New Support Ticket Created</h2>
              <p><strong>Ticket:</strong> ${ticket.ticket_number}</p>
              <p><strong>Priority:</strong> ${ticket.priority}</p>
              <p><strong>Subject:</strong> ${ticket.subject}</p>
              <p><strong>Description:</strong> ${ticket.description}</p>
              <p><a href="${ticketUrl}">Click here to view/claim ticket</a></p>
            `
          });
          emailsSent++;
        }
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
      }
    }

    return Response.json({
      success: true,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      department: department,
      workers_notified: workerEmails.length,
      notifications_created: notificationsCreated,
      teams_messages_sent: teamsMessagesSent,
      emails_sent: emailsSent
    });

  } catch (error) {
    console.error('Error in notifyDepartmentNewTicket:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});