import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const roomId = pathParts[pathParts.indexOf('acknowledgeRoomWarning') - 1] || pathParts[pathParts.length - 2];

    const body = await req.json();
    const { user_id, user_name, notes } = body;

    if (!roomId) {
      return Response.json({ error: 'room_id required in URL path' }, { status: 400 });
    }

    // Verify room exists
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (!rooms || rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    // Get current warning to capture warning text
    // For now, use a generic warning text since we need to know what warning was acknowledged
    const warningText = notes || `Cleaning warning acknowledged for ${room.room_name}`;

    // Create acknowledgment
    const acknowledgment = await base44.asServiceRole.entities.CleaningAcknowledgment.create({
      room_id: roomId,
      warning_text: warningText,
      acknowledged_by: user_name || user.full_name || user.email,
      acknowledged_at: new Date().toISOString(),
      auto_cleared: false,
      notes: notes || null
    });

    return Response.json({
      success: true,
      acknowledgment_id: acknowledgment.id,
      message: `Warning acknowledged for ${room.room_name}`
    });

  } catch (error) {
    console.error('acknowledgeRoomWarning error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});