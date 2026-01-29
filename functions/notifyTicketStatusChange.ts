import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();
    
    // Only process updates
    if (event.type !== 'update' || !old_data) {
      return Response.json({ status: 'ignored' });
    }
    
    const statusChanged = data.status !== old_data.status;
    
    if (statusChanged && data.teams_conversation_id) {
      // Log status change to activity
      const activityEntry = {
        author_email: 'system',
        author_name: 'System',
        content: `Status changed from ${old_data.status.replace('_', ' ')} to ${data.status.replace('_', ' ')}`,
        is_internal: false,
        timestamp: new Date().toISOString()
      };
      
      await base44.asServiceRole.entities.Ticket.update(data.id, {
        comments: [...(data.comments || []), activityEntry]
      });
      
      // Send Teams notification based on status
      const messageType = data.status === 'resolved' ? 'resolved' : 'status_change';
      
      await base44.asServiceRole.functions.invoke('sendTeamsTicketUpdate', {
        ticket_id: data.id,
        message_type: messageType
      });
    }
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Status change notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});