import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This is a scheduled job, so we use service role
    const now = new Date();
    
    // Get all non-cleared acknowledgments that have an event_time
    const allAcknowledgments = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
      auto_cleared: false
    });
    
    let clearedCount = 0;
    const errors = [];
    
    for (const ack of allAcknowledgments) {
      // Skip if no event_time (non-bookable room acknowledgments)
      if (!ack.event_time) continue;
      
      const eventTime = new Date(ack.event_time);
      
      // If event has passed, auto-clear the acknowledgment
      if (now > eventTime) {
        try {
          await base44.asServiceRole.entities.CleaningAcknowledgment.update(ack.id, {
            auto_cleared: true,
            auto_cleared_at: now.toISOString()
          });
          clearedCount++;
        } catch (error) {
          errors.push({
            acknowledgment_id: ack.id,
            room_id: ack.room_id,
            error: error.message
          });
        }
      }
    }
    
    return Response.json({
      success: true,
      checked_count: allAcknowledgments.length,
      cleared_count: clearedCount,
      errors: errors.length > 0 ? errors : null,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('autoClearCleaningAcknowledgments error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});