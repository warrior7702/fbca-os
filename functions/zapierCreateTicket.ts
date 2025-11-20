import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const {
      subject,
      body,
      from_email,
      from_name,
      category,
      confidence
    } = await req.json();
    
    if (!subject || !body || !from_email) {
      return Response.json({
        error: 'Missing required fields: subject, body, from_email'
      }, { status: 400 });
    }

    // Map category to ticket category (case-insensitive)
    const categoryLower = (category || '').toLowerCase();
    let ticketCategory = 'maintenance'; // default
    
    if (categoryLower.includes('tech') || categoryLower.includes('it')) {
      ticketCategory = 'technology';
    } else if (categoryLower.includes('clean')) {
      ticketCategory = 'cleaning';
    } else if (categoryLower.includes('maintain')) {
      ticketCategory = 'maintenance';
    }
    
    // Generate ticket number
    const allTickets = await base44.asServiceRole.entities.Ticket.list();
    const ticketNumber = `TKT-${String(allTickets.length + 1).padStart(6, '0')}`;
    
    // Create ticket
    const ticket = await base44.asServiceRole.entities.Ticket.create({
      ticket_number: ticketNumber,
      subject: subject,
      description: body,
      category: ticketCategory,
      source: 'email',
      status: 'open',
      priority: 'medium',
      requester_email: from_email,
      requester_name: from_name || from_email,
      created_date: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      tags: confidence ? [`ai_confidence_${Math.round(confidence * 100)}`] : []
    });
    
    // Auto-assign based on category
    try {
      await base44.asServiceRole.functions.invoke('autoAssignTicket', {
        ticket_id: ticket.id
      });
    } catch (error) {
      console.log('Auto-assign skipped:', error.message);
    }

    return Response.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        category: ticket.category,
        status: ticket.status
      }
    });

  } catch (error) {
    console.error('Ticket creation error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});