import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const now = new Date();

    // Get all uncleared acknowledgments with event_time in the past
    const allAcks = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
      auto_cleared: false
    });

    const toClear = allAcks.filter(ack => {
      if (!ack.event_time) return false;
      const eventTime = new Date(ack.event_time);
      return eventTime < now;
    });

    // Update each acknowledgment
    let clearedCount = 0;
    for (const ack of toClear) {
      await base44.asServiceRole.entities.CleaningAcknowledgment.update(ack.id, {
        auto_cleared: true,
        auto_cleared_at: now.toISOString()
      });
      clearedCount++;
    }

    console.log(`Auto-cleared ${clearedCount} acknowledgments`);

    return Response.json({
      success: true,
      cleared_count: clearedCount,
      message: `Auto-cleared ${clearedCount} acknowledgments`
    });

  } catch (error) {
    console.error('autoClearAcknowledgments error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});