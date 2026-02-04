import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';



// Determine alert level based on time until event
function getAlertLevel(hoursUntilEvent) {
  if (hoursUntilEvent <= 6) return 'ALERT';
  if (hoursUntilEvent <= 24) return 'WARM';
  return 'COOL';
}

// Format date helper
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

// Add hours to date
function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

// Get next event for bookable rooms
async function getNextEventsBatch(base44, roomIds) {
  const now = new Date();
  const roomEventMap = {};
  
  // Initialize all rooms to null
  roomIds.forEach(id => {
    roomEventMap[id] = null;
  });
  
  if (roomIds.length === 0) return roomEventMap;
  
  try {
    // Fetch upcoming event rooms in batches
    const eventRooms = await base44.asServiceRole.entities.PCO_EventRoom.list('-start_time', 500);
    
    // Filter for upcoming events in next 3 days
    const upcomingEventRooms = eventRooms.filter(er => {
      if (!er.start_time || !roomIds.includes(er.room_id)) return false;
      const startTime = new Date(er.start_time);
      const daysAhead = (startTime - now) / (1000 * 60 * 60 * 24);
      return daysAhead >= 0 && daysAhead <= 3;
    });
    
    // Get first upcoming event for each room
    const processed = new Set();
    upcomingEventRooms.forEach(er => {
      if (!processed.has(er.room_id) && er.event_name && er.start_time) {
        roomEventMap[er.room_id] = {
          name: er.event_name,
          start_time: new Date(er.start_time)
        };
        processed.add(er.room_id);
      }
    });
    
  } catch (e) {
    console.warn('Failed to fetch events:', e.message);
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

    // Filter by building if specified
    if (building) {
      rooms = rooms.filter(r => r.building_name === building || r.building === building);
    }

    // Batch fetch all events for all rooms
    const allRoomIds = rooms.map(r => r.id);
    const nextEventMap = allRoomIds.length > 0 
      ? await getNextEventsBatch(base44, allRoomIds)
      : {};

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
        
        // Only show if event is within 48 hours
        if (hoursUntilEvent > 48) return null;
        
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