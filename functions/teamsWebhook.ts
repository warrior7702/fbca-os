import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const activityType = body.type;
    
    // Handle message from user
    if (activityType === 'message') {
      const userMessage = body.text?.trim();
      const conversationId = body.conversation?.id;
      const serviceUrl = body.serviceUrl;
      const ticketId = body.value?.ticket_id; // From adaptive card action
      
      if (!ticketId || !userMessage) {
        return Response.json({ status: 'ignored' });
      }
      
      // Get ticket
      const ticket = await base44.asServiceRole.entities.Ticket.get(ticketId);
      
      if (!ticket) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }
      
      // Add user comment to ticket
      const newComment = {
        author_email: ticket.requester_email,
        author_name: ticket.requester_name,
        content: userMessage,
        is_internal: false,
        timestamp: new Date().toISOString()
      };
      
      await base44.asServiceRole.entities.Ticket.update(ticket.id, {
        comments: [...(ticket.comments || []), newComment],
        last_activity_at: new Date().toISOString()
      });
      
      // Store conversation context if not already stored
      if (!ticket.teams_conversation_id) {
        await base44.asServiceRole.entities.Ticket.update(ticket.id, {
          teams_conversation_id: conversationId,
          teams_service_url: serviceUrl
        });
      }
      
      // Notify assigned staff
      if (ticket.assigned_to) {
        await base44.asServiceRole.functions.invoke('createNotification', {
          user_email: ticket.assigned_to,
          type: 'ticket_comment',
          title: `New comment on ${ticket.ticket_number}`,
          message: `${ticket.requester_name}: ${userMessage.substring(0, 100)}`,
          related_ticket_id: ticket.id,
          related_ticket_number: ticket.ticket_number,
          action_url: `/ticketdetail?id=${ticket.id}`,
          send_email: true
        });
      }
      
      return Response.json({ 
        success: true,
        message: 'Comment added to ticket' 
      });
    }
    
    return Response.json({ status: 'ok' });
  } catch (error) {
    console.error('Teams webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});