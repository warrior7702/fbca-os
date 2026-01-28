import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json().catch(() => ({}));
    const { requester_email: providedEmail, limit = 10 } = body;

    // Determine requester email
    let requesterEmail = providedEmail;
    
    if (!requesterEmail) {
      // Try to get from authenticated user
      try {
        const user = await base44.auth.me();
        requesterEmail = user?.email;
      } catch (error) {
        // No authenticated user, that's ok - we'll check below
      }
    }

    // If still no email, return error
    if (!requesterEmail) {
      return Response.json({ 
        success: false, 
        error: 'No requester_email provided and no authenticated user found' 
      }, { status: 200 });
    }

    // Query tickets with open-like statuses using service role for admin access
    const openStatuses = ['open', 'awaiting_information', 'awaiting_parts'];
    const allTickets = await base44.asServiceRole.entities.Ticket.list('-created_date');
    
    const filteredTickets = allTickets.filter(ticket => 
      ticket.requester_email === requesterEmail && 
      openStatuses.includes(ticket.status)
    );

    // Return only the specified fields
    const response = {
      success: true,
      requester_email: requesterEmail,
      count: filteredTickets.length,
      tickets: filteredTickets.map(ticket => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        created_date: ticket.created_date
      }))
    };

    return Response.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in getMyOpenTickets:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error occurred' 
    }, { status: 200 });
  }
});