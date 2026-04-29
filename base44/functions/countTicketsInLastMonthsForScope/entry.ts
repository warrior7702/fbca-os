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
    const { asset_id, room_id, months = 6 } = await req.json();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    // Fetch all tickets (we'll filter client-side)
    const allTickets = await base44.entities.Ticket.list();

    // Filter tickets based on criteria
    let count = 0;
    
    for (const ticket of allTickets) {
      // Check date
      if (new Date(ticket.created_date) < cutoffDate) {
        continue;
      }

      // Check if matches asset or room
      if (asset_id && ticket.asset_id === asset_id) {
        count++;
      } else if (room_id && ticket.room_id === room_id) {
        count++;
      }
    }

    return Response.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('Error in countTicketsInLastMonthsForScope:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});