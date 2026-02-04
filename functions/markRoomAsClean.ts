import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { room_id, marked_by_user_id, marked_by_user_name } = body;

    if (!room_id) {
      return Response.json({ error: 'room_id required in request body' }, { status: 400 });
    }

    const roomId = room_id;

    const now = new Date().toISOString();

    // 1. Update room's last_cleaned_at
    await base44.asServiceRole.entities.Room.update(roomId, {
      last_cleaned_at: now
    });

    // 2. Create audit log
    await base44.asServiceRole.entities.CleaningLog.create({
      room_id: roomId,
      action: 'marked_clean',
      performed_by: marked_by_user_id || user.email,
      performed_by_name: marked_by_user_name || user.full_name || user.email,
      performed_at: now,
      notes: 'Manually marked as clean via UI'
    });

    // 3. Auto-clear any pending acknowledgments for this room
    const pendingAcks = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
      room_id: roomId,
      auto_cleared: false
    });

    for (const ack of pendingAcks) {
      await base44.asServiceRole.entities.CleaningAcknowledgment.update(ack.id, {
        auto_cleared: true,
        auto_cleared_at: now
      });
    }

    return Response.json({
      success: true,
      room_id: roomId,
      last_cleaned_at: now,
      acknowledgments_cleared: pendingAcks.length
    });

  } catch (error) {
    console.error('markRoomAsClean error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});