import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClient().asServiceRole;
    
    const payload = await req.json();
    
    // Accept both 'dept' and 'department' field names
    const {
      subject,
      body,
      sender,
      dept,
      department,
      classification
    } = payload;
    
    if (!subject || !body || !sender) {
      return Response.json({
        error: 'Missing required fields: subject, body, sender'
      }, { status: 400 });
    }

    // Use dept or department, fallback to empty string
    const deptValue = dept || department || '';
    const deptNormalized = deptValue.toLowerCase();

    // Map department/category to ticket category
    const categoryMap = {
      'technology': 'technology',
      'tech': 'technology',
      'cleaning': 'cleaning',
      'maintenance': 'maintenance',
      'maint': 'maintenance',
      'facilities': 'maintenance'
    };

    const ticketCategory = categoryMap[deptNormalized] || 'maintenance';

    // Generate ticket number
    const allTickets = await base44.entities.Ticket.list();
    const ticketNumber = `TKT-${String(allTickets.length + 1).padStart(6, '0')}`;

    // Handle classification if provided
    const tags = [];
    if (classification && typeof classification === 'object' && classification.confidence) {
      tags.push(`ai_confidence_${Math.round(classification.confidence * 100)}`);
    }

    // Create ticket
    const ticket = await base44.entities.Ticket.create({
      ticket_number: ticketNumber,
      subject: subject,
      description: body,
      category: ticketCategory,
      source: 'email',
      status: 'open',
      priority: 'medium',
      requester_email: sender,
      requester_name: sender,
      last_activity_at: new Date().toISOString(),
      tags: tags
    });

    // Try auto-assign
    try {
      await base44.functions.invoke('autoAssignTicket', {
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
    console.error('Error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});