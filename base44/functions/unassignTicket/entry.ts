import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return Response.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    // Clear ticket assignment
    await base44.entities.Ticket.update(ticket_id, {
      assigned_to: null,
      assigned_to_name: null,
      last_activity_at: new Date().toISOString()
    });

    return Response.json({
      success: true
    });

  } catch (error) {
    console.error('Error unassigning ticket:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});