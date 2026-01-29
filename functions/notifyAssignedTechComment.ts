import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticket_id } = await req.json();
    
    if (!ticket_id) {
      return Response.json({ success: false, error: 'ticket_id required' }, { status: 400 });
    }
    
    // Load ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticket_id);
    
    if (!ticket) {
      return Response.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    
    // Check if there's an assigned tech
    if (!ticket.assigned_to) {
      return Response.json({ 
        success: true, 
        message: 'No assigned tech to notify',
        teams_message_sent: 0,
        emails_sent: 0
      });
    }
    
    // Get the latest comment
    const latestComment = ticket.comments?.[ticket.comments.length - 1];
    
    if (!latestComment) {
      return Response.json({ 
        success: true, 
        message: 'No comments found',
        teams_message_sent: 0,
        emails_sent: 0
      });
    }
    
    // Only notify if comment is from requester
    if (latestComment.author_email !== ticket.requester_email) {
      return Response.json({ 
        success: true, 
        message: 'Comment not from requester, skipping notification',
        teams_message_sent: 0,
        emails_sent: 0
      });
    }
    
    // Build notification message
    const message = `💬 **New comment on ${ticket.ticket_number}**\n\n**From:** ${latestComment.author_name || latestComment.author_email}\n\n${latestComment.content}`;
    
    let teamsMessageSent = 0;
    let emailsSent = 0;
    
    // Send in-app notification
    try {
      await base44.asServiceRole.functions.invoke('createNotification', {
        user_email: ticket.assigned_to,
        type: 'ticket_comment',
        title: `New comment on ${ticket.ticket_number}`,
        message: latestComment.content,
        related_ticket_id: ticket_id,
        related_ticket_number: ticket.ticket_number,
        action_url: `/SupportTickets?id=${ticket_id}`,
        send_email: false // Email handled separately below
      });
    } catch (notifyError) {
      console.warn('In-app notification failed:', notifyError);
    }
    
    // Send Teams message via SparkBot
    try {
      await base44.asServiceRole.functions.invoke('sendTeamsMessage', {
        user_email: ticket.assigned_to,
        message: message
      });
      teamsMessageSent = 1;
    } catch (teamsError) {
      console.warn('Teams message failed:', teamsError);
    }
    
    // Check notification preferences and send email if opted in
    try {
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
        user_email: ticket.assigned_to
      });
      
      const userPref = prefs[0];
      
      // Send email if preference is enabled (default is true)
      if (!userPref || userPref.ticket_comment_email !== false) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ticket.assigned_to,
          subject: `New comment on ticket ${ticket.ticket_number}`,
          body: `${message}\n\nView ticket: ${Deno.env.get('BASE44_APP_URL')}/SupportTickets?id=${ticket_id}`
        });
        emailsSent = 1;
      }
    } catch (emailError) {
      console.warn('Email notification failed:', emailError);
    }
    
    return Response.json({
      success: true,
      ticket_id: ticket_id,
      assigned_to: ticket.assigned_to,
      teams_message_sent: teamsMessageSent,
      emails_sent: emailsSent
    });
  } catch (error) {
    console.error('Error notifying assigned tech:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});