import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticket_id, notification_type, comment, new_status, assigned_to } = await req.json();

    if (!ticket_id || !notification_type) {
      return Response.json({ 
        error: 'Missing required parameters: ticket_id, notification_type' 
      }, { status: 400 });
    }

    // Get ticket details using service role
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = tickets[0];
    const ticketUrl = `${Deno.env.get('BASE44_APP_URL')}/support-tickets?id=${ticket_id}`;

    let subject = '';
    let body = '';
    let recipient = '';

    switch (notification_type) {
      case 'comment_added':
        subject = `New comment on ticket ${ticket.ticket_number}`;
        body = `
          <h2>New Comment Added</h2>
          <p>A new comment has been added to your support ticket:</p>
          <p><strong>Ticket:</strong> ${ticket.subject} (${ticket.ticket_number})</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${comment}</p>
          </div>
          <p><a href="${ticketUrl}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
        `;
        recipient = ticket.requester_email;
        break;

      case 'status_changed':
        subject = `Ticket ${ticket.ticket_number} status updated to ${new_status}`;
        body = `
          <h2>Ticket Status Updated</h2>
          <p>Your support ticket status has been updated:</p>
          <p><strong>Ticket:</strong> ${ticket.subject} (${ticket.ticket_number})</p>
          <p><strong>New Status:</strong> <span style="text-transform: capitalize;">${new_status.replace('_', ' ')}</span></p>
          <p><a href="${ticketUrl}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
        `;
        recipient = ticket.requester_email;
        break;

      case 'assigned':
        subject = `Ticket ${ticket.ticket_number} assigned to you`;
        body = `
          <h2>New Ticket Assigned</h2>
          <p>A support ticket has been assigned to you:</p>
          <p><strong>Ticket:</strong> ${ticket.subject} (${ticket.ticket_number})</p>
          <p><strong>Priority:</strong> <span style="text-transform: capitalize;">${ticket.priority}</span></p>
          <p><strong>Requester:</strong> ${ticket.requester_name} (${ticket.requester_email})</p>
          <p><a href="${ticketUrl}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
        `;
        recipient = assigned_to;
        break;

      default:
        return Response.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    // Send email
    await base44.integrations.Core.SendEmail({
      to: recipient,
      subject: subject,
      body: body,
      from_name: 'FBCA Support System'
    });

    return Response.json({ 
      success: true,
      email_sent_to: recipient 
    });

  } catch (error) {
    console.error('Ticket notification error:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
});