import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ticket_id, message } = await req.json();

        if (!ticket_id || !message) {
            return Response.json({ error: 'ticket_id and message are required' }, { status: 400 });
        }

        // Get the ticket
        const tickets = await base44.entities.Ticket.filter({ id: ticket_id });
        const ticket = tickets[0];

        if (!ticket) {
            return Response.json({ error: 'Ticket not found' }, { status: 404 });
        }

        if (!ticket.teams_conversation_id || !ticket.teams_service_url) {
            return Response.json({ 
                error: 'No Teams conversation linked to this ticket',
                hint: 'This ticket was not created via Teams bot'
            }, { status: 400 });
        }

        // Get Bot Framework access token
        const botAppId = Deno.env.get('TEAMS_BOT_APP_ID');
        const botAppSecret = Deno.env.get('TEAMS_BOT_APP_SECRET');

        if (!botAppId || !botAppSecret) {
            return Response.json({ error: 'Bot credentials not configured' }, { status: 500 });
        }

        // Get OAuth token from Bot Framework
        const tokenResponse = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: botAppId,
                client_secret: botAppSecret,
                scope: 'https://api.botframework.com/.default'
            })
        });

        if (!tokenResponse.ok) {
            const err = await tokenResponse.text();
            console.error('Token error:', err);
            return Response.json({ error: 'Failed to get bot token' }, { status: 500 });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Build adaptive card message
        const cardMessage = {
            type: 'message',
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                    type: 'AdaptiveCard',
                    version: '1.4',
                    body: [
                        {
                            type: 'TextBlock',
                            text: `📨 Update on ${ticket.ticket_number}`,
                            weight: 'bolder',
                            size: 'medium'
                        },
                        {
                            type: 'TextBlock',
                            text: ticket.subject,
                            wrap: true,
                            color: 'accent'
                        },
                        {
                            type: 'Container',
                            style: 'emphasis',
                            items: [{
                                type: 'TextBlock',
                                text: message,
                                wrap: true
                            }]
                        },
                        {
                            type: 'TextBlock',
                            text: `— ${user.full_name || user.email}`,
                            size: 'small',
                            isSubtle: true
                        }
                    ]
                }
            }]
        };

        // Send message via Bot Framework
        const serviceUrl = ticket.teams_service_url.replace(/\/$/, '');
        const conversationId = ticket.teams_conversation_id;
        
        const sendUrl = `${serviceUrl}/v3/conversations/${conversationId}/activities`;
        
        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cardMessage)
        });

        if (!sendResponse.ok) {
            const err = await sendResponse.text();
            console.error('Send error:', err);
            return Response.json({ error: 'Failed to send Teams message', details: err }, { status: 500 });
        }

        const result = await sendResponse.json();

        return Response.json({ 
            success: true, 
            message_id: result.id,
            sent_to: ticket.requester_name || ticket.requester_email
        });

    } catch (error) {
        console.error('Error sending Teams message:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});