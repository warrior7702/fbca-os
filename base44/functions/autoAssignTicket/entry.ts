import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return Response.json({ error: 'ticket_id required' }, { status: 400 });
    }

    // Get the ticket
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }
    const ticket = tickets[0];

    // Use assigned_department as source of truth, fallback to category mapping
    let department = ticket.assigned_department;
    
    if (!department) {
      // Fallback: map from category
      const deptMap = {
        'technology': 'IT',
        'cleaning': 'Facilities',
        'maintenance': 'Facilities'
      };
      department = deptMap[ticket.category] || null;
    }

    // Assignment rules based on department
    const assignmentRules = {
      // IT tickets go to Billy Nelms
      'IT': { email: 'billy.nelms@fbca.org', name: 'Billy Nelms' },
      
      // Facilities - leave unassigned for pool pickup
      'Facilities': null
    };

    const rule = assignmentRules[department];
    
    // If no rule or rule is null (pool), leave unassigned
    if (!rule) {
      return Response.json({ 
        success: true,
        assigned: false,
        reason: 'No assignment rule or pool ticket'
      });
    }

    // Assign the ticket
    await base44.asServiceRole.entities.Ticket.update(ticket_id, {
      assigned_to: rule.email,
      assigned_to_name: rule.name,
      last_activity_at: new Date().toISOString()
    });

    // Send notification
    try {
      await base44.asServiceRole.functions.invoke('createNotification', {
        user_email: rule.email,
        type: 'ticket_assigned',
        title: 'New Ticket Assigned',
        message: `You've been assigned: ${ticket.subject}`,
        related_ticket_id: ticket_id,
        related_ticket_number: ticket.ticket_number,
        action_url: `/TicketDetail?id=${ticket_id}`
      });
    } catch (notifError) {
      console.warn('Failed to send notification:', notifError);
    }

    return Response.json({ 
      success: true,
      assigned: true,
      assigned_to: rule.email,
      assigned_to_name: rule.name
    });

  } catch (error) {
    console.error('Error auto-assigning ticket:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});