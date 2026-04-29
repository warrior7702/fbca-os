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
      
      // Notify assigned staff (in-app + optional Teams DM)
      const assignees = [ticket.assigned_to, ticket.assigned_to_2]
        .filter(Boolean)
        .map((email) => String(email).toLowerCase())
        .filter((email, idx, arr) => arr.indexOf(email) === idx);

      if (assignees.length > 0) {
        const preview = `${ticket.requester_name}: ${userMessage.substring(0, 100)}`;
        const proactiveUrl = Deno.env.get('SPARKBOT_PROACTIVE_URL') || '';
        const proactiveSecret = Deno.env.get('SPARKBOT_PROACTIVE_SECRET') || '';

        for (const email of assignees) {
          await base44.asServiceRole.functions.invoke('createNotification', {
            user_email: email,
            type: 'ticket_comment',
            title: `New comment on ${ticket.ticket_number}`,
            message: preview,
            related_ticket_id: ticket.id,
            related_ticket_number: ticket.ticket_number,
            action_url: `/ticketdetail?id=${ticket.id}`,
            send_email: true
          });

          if (proactiveUrl && proactiveSecret) {
            try {
              const users = await base44.asServiceRole.entities.User.filter({ email });
              const user = users?.[0];
              const refRaw = user?.teams_dm_conversation_reference || null;
              if (!refRaw) continue;

              const conversationReference =
                typeof refRaw === 'string' ? JSON.parse(refRaw) : refRaw;

              await fetch(proactiveUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${proactiveSecret}`
                },
                body: JSON.stringify({
                  conversationReference,
                  message: `💬 ${preview}`,
                  title: `New comment on ${ticket.ticket_number}`
                })
              });
            } catch (dmError) {
              console.error(`Failed to send Teams DM to ${email}:`, dmError);
            }
          }
        }
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
