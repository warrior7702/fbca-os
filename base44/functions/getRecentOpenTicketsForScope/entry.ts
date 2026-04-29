import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { scope, asset_id, room_id, building_id, days = 30 } = await req.json();

    // Validate scope
    if (!scope || !['ASSET', 'ROOM', 'BUILDING'].includes(scope)) {
      return Response.json({ 
        success: false, 
        error: 'Invalid scope. Must be ASSET, ROOM, or BUILDING' 
      }, { status: 400 });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Fetch all tickets (we'll filter client-side due to query limitations)
    const allTickets = await base44.entities.Ticket.list('-created_date');

    // Filter tickets based on criteria
    const filteredTickets = allTickets.filter(ticket => {
      // Check status
      if (!['open', 'awaiting_information', 'awaiting_parts'].includes(ticket.status)) {
        return false;
      }

      // Check date
      if (new Date(ticket.created_date) < cutoffDate) {
        return false;
      }

      // Check scope and IDs
      if (scope === 'ASSET') {
        return ticket.scope === 'ASSET' && ticket.asset_id === asset_id;
      } else if (scope === 'ROOM') {
        return ticket.scope === 'ROOM' && ticket.room_id === room_id;
      } else if (scope === 'BUILDING') {
        return ticket.scope === 'BUILDING' && ticket.building_id === building_id;
      }

      return false;
    });

    // Return only safe/light fields
    const safeTickets = filteredTickets.map(ticket => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      status: ticket.status,
      created_date: ticket.created_date
    }));

    return Response.json({
      success: true,
      tickets: safeTickets
    });

  } catch (error) {
    console.error('Error in getRecentOpenTicketsForScope:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});