import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticket_id, message_type, custom_message } = await req.json();
    
    // Get ticket
    const ticket = await base44.asServiceRole.entities.Ticket.get(ticket_id);
    
    if (!ticket || !ticket.teams_conversation_id) {
      return Response.json({ 
        success: false, 
        error: 'No Teams conversation found for this ticket' 
      });
    }
    
    // Build message based on type
    let message = custom_message;
    
    if (!custom_message) {
      const statusMessages = {
        'status_change': `🔔 **Ticket ${ticket.ticket_number} Status Update**\n\nStatus: **${ticket.status.replace('_', ' ').toUpperCase()}**`,
        'comment_added': `💬 **New Comment on ${ticket.ticket_number}**\n\n${ticket.comments?.[ticket.comments.length - 1]?.content || ''}`,
        'resolved': `✅ **Ticket ${ticket.ticket_number} Resolved**\n\n**Issue:** ${ticket.subject}\n\n**Resolution:** ${ticket.comments?.reverse().find(c => c.content?.toLowerCase().includes('resolution') || c.content?.toLowerCase().includes('resolved'))?.content || 'Issue has been fixed.'}\n\nIf you need further help, reply here or create a new ticket.`
      };
      
      message = statusMessages[message_type] || `Update on ticket ${ticket.ticket_number}`;
    }
    
    // Get bot token
    const botAppId = Deno.env.get('TEAMS_BOT_APP_ID');
    const botAppSecret = Deno.env.get('TEAMS_BOT_APP_SECRET');
    
    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: botAppId,
          client_secret: botAppSecret,
          scope: 'https://api.botframework.com/.default'
        })
      }
    );
    const { access_token } = await tokenResponse.json();
    
    // Send proactive message
    await fetch(`${ticket.teams_service_url}/v3/conversations/${ticket.teams_conversation_id}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message',
        text: message
      })
    });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending Teams update:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});