import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticket_number } = await req.json();
    
    if (!ticket_number) {
      return Response.json({ error: 'ticket_number is required' }, { status: 400 });
    }
    
    // Look up ticket by number
    const tickets = await base44.asServiceRole.entities.Ticket.filter({
      ticket_number: ticket_number.toUpperCase()
    });
    
    if (tickets.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Ticket not found' 
      }, { status: 404 });
    }
    
    const ticket = tickets[0];
    
    return Response.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        requester_email: ticket.requester_email,
        requester_name: ticket.requester_name,
        assigned_to: ticket.assigned_to,
        assigned_to_name: ticket.assigned_to_name,
        teams_conversation_id: ticket.teams_conversation_id,
        teams_service_url: ticket.teams_service_url
      }
    });
  } catch (error) {
    console.error('Error looking up ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});