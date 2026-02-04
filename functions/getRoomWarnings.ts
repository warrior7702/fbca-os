import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Determine alert level based on time until event
function getAlertLevel(hoursUntilEvent) {
  if (hoursUntilEvent <= 6) return 'ALERT';
  if (hoursUntilEvent <= 24) return 'NOTICE';
  return null;
}

// Get all PCO bookable rooms with their upcoming events
async function getPCOEventsByRoom(base44) {
  const roomEventMap = {};
  const now = new Date();
  
  try {
    // Fetch all PCO resource requests (they contain room + event info)
    const requests = await base44.asServiceRole.entities.PCO_Request.list('-created_at', 500);
    console.log(`[DEBUG] Fetched ${requests.length} PCO requests`);
    
    // Group by room_id and get first upcoming event per room
    requests.forEach(req => {
      if (!req.room_id || !req.event_starts_at) return;
      
      const startTime = new Date(req.event_starts_at);
      const hoursAhead = (startTime - now) / (1000 * 60 * 60);
      
      // Only consider events in next 24 hours
      if (hoursAhead < 0 || hoursAhead > 24) return;
      
      // Keep first event for each room
      if (!roomEventMap[req.room_id] || startTime < new Date(roomEventMap[req.room_id].start_time)) {
        roomEventMap[req.room_id] = {
          name: req.event_name || 'Event',
          start_time: startTime.toISOString(),
          pco_room_id: req.room_id
        };
      }
    });
    
    console.log(`[DEBUG] Found ${Object.keys(roomEventMap).length} rooms with events in next 24 hours`);
    
  } catch (e) {
    console.error('Failed to fetch events from PCO:', e.message);
  }
  
  return roomEventMap;
}



Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const building = url.searchParams.get('building');
    const temperatureFilter = url.searchParams.get('temperature');

    // Get all rooms
    let rooms = await base44.asServiceRole.entities.Room.list();
    console.log(`[DEBUG] Total rooms: ${rooms.length}`);

    // Filter by building if specified
    if (building) {
      rooms = rooms.filter(r => r.building_name === building || r.building === building);
      console.log(`[DEBUG] Rooms in building "${building}": ${rooms.length}`);
    }

    // Fetch events from PCO_Request (which has room + event links)
    const pcoEventsByRoom = await getPCOEventsByRoom(base44);
    
    // Map PCO room IDs to Campus Hub room IDs
    const roomMap = {};
    rooms.forEach(room => {
      if (room.pco_resource_id) {
        roomMap[room.pco_resource_id] = room;
      }
    });
    console.log(`[DEBUG] Built room map for ${Object.keys(roomMap).length} rooms`);
    
    // Map events to Campus Hub rooms
    const nextEventMap = {};
    Object.entries(pcoEventsByRoom).forEach(([pcoRoomId, event]) => {
      const room = roomMap[pcoRoomId];
      if (room) {
        nextEventMap[room.id] = event;
      }
    });
    console.log(`[DEBUG] Mapped ${Object.keys(nextEventMap).length} events to Campus Hub rooms`);

    // Cache all acknowledgments upfront - with retry
    let allAcknowledgments = [];
    try {
      allAcknowledgments = await base44.asServiceRole.entities.CleaningAcknowledgment.list();
    } catch (e) {
      console.warn('Failed to fetch acknowledgments:', e.message);
    }
    
    const acksByRoom = Object.fromEntries(
      rooms.map(r => [r.id, allAcknowledgments.filter(a => a.room_id === r.id)])
    );

    // Compute warnings - only for bookable rooms with upcoming events
    const warnings = [];
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < rooms.length; i += BATCH_SIZE) {
      const batch = rooms.slice(i, i + BATCH_SIZE);
      
      const batchWarnings = batch.map((room) => {
        // Only show warnings for bookable rooms with events
        if (!room.is_bookable) return null;
        
        const nextEvent = nextEventMap[room.id];
        if (!nextEvent) return null;
        
        const now = new Date();
        const hoursUntilEvent = (nextEvent.start_time - now) / (1000 * 60 * 60);
        
        // Only show if event is within 24 hours
        if (hoursUntilEvent > 24) return null;
        
        // Check for active acknowledgment
        const acksForRoom = acksByRoom[room.id] || [];
        const lastCleanedDate = room.last_cleaned_at ? new Date(room.last_cleaned_at) : new Date(0);
        const activeAck = acksForRoom.find(ack => {
          const ackDate = new Date(ack.acknowledged_at);
          return ackDate > lastCleanedDate && !ack.auto_cleared;
        });
        
        if (activeAck) return null;
        
        const temperature = getAlertLevel(hoursUntilEvent);
        
        // Filter by temperature if specified
        if (temperatureFilter && temperature !== temperatureFilter) {
          return null;
        }
        
        return {
          room_id: room.id,
          room_name: room.room_name,
          room_number: room.room_number,
          building: room.building_name || room.building,
          floor: room.floor_name || room.floor,
          warning_text: `Needs cleaned before ${nextEvent.name}`,
          temperature: temperature,
          event_time: nextEvent.start_time.toISOString(),
          event_name: nextEvent.name,
          room: {
            id: room.id,
            room_name: room.room_name,
            room_number: room.room_number
          }
        };
      });
      
      warnings.push(...batchWarnings.filter(w => w !== null));
      
      // Delay between batches to avoid rate limit
      if (i + BATCH_SIZE < rooms.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return Response.json({
      success: true,
      warnings,
      total_count: warnings.length
    });

  } catch (error) {
    console.error('getRoomWarnings error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});