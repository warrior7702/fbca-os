import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { requester_email, limit = 5 } = body;

    // Validate requester_email
    if (!requester_email || typeof requester_email !== 'string') {
      return Response.json({ error: 'requester_email required' }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requester_email)) {
      return Response.json({ error: 'requester_email required' }, { status: 400 });
    }

    // Enforce max limit of 10
    const effectiveLimit = Math.min(Math.max(1, limit), 10);

    // Query open tickets for this user
    const tickets = await base44.entities.Ticket.filter(
      { 
        requester_email: requester_email,
        status: 'open'
      },
      '-created_date',
      effectiveLimit
    );

    // Return only the specified fields
    const response = {
      tickets: tickets.map(ticket => ({
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        created_date: ticket.created_date
      }))
    };

    return Response.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in getMyOpenTickets:', error);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
});