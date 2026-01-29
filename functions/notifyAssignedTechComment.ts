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
    
    // Send Teams message via Microsoft Graph API
    try {
      // Get Microsoft Graph access token
      const clientId = Deno.env.get('MS_CLIENT_ID') || Deno.env.get('MICROSOFT_CLIENT_ID');
      const clientSecret = Deno.env.get('MS_CLIENT_SECRET') || Deno.env.get('MICROSOFT_CLIENT_SECRET');
      const tenantId = Deno.env.get('MS_TENANT_ID') || Deno.env.get('MICROSOFT_APP_TENANT_ID');
      
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default'
          })
        }
      );
      
      if (tokenResponse.ok) {
        const { access_token } = await tokenResponse.json();
        
        // Send Teams chat message
        const chatMessage = {
          body: {
            contentType: 'text',
            content: message
          }
        };
        
        const sendResponse = await fetch(
          `https://graph.microsoft.com/v1.0/users/${ticket.assigned_to}/chats`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              chatType: 'oneOnOne',
              members: [
                {
                  '@odata.type': '#microsoft.graph.aadUserConversationMember',
                  roles: ['owner'],
                  'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${ticket.assigned_to}')`
                }
              ]
            })
          }
        );
        
        if (sendResponse.ok) {
          const chat = await sendResponse.json();
          
          // Send message to the chat
          await fetch(
            `https://graph.microsoft.com/v1.0/chats/${chat.id}/messages`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(chatMessage)
            }
          );
          
          teamsMessageSent = 1;
        }
      }
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