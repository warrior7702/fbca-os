import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get last Monday from a given date
function getLastMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Check if date is before a service day (Tues or Sat)
function isBeforeServiceDay(date) {
  const day = date.getDay();
  return day === 2 || day === 6;
}

// Calculate room temperature
function getRoomTemperature(room) {
  const schedule = room.cleaning_schedule;
  const lastCleaned = room.last_cleaned_at;
  const now = new Date();
  
  if (!lastCleaned) return 'HOT';
  
  const lastCleanedDate = new Date(lastCleaned);
  const hoursSinceClean = (now - lastCleanedDate) / (1000 * 60 * 60);
  
  switch(schedule) {
    case 'daily':
      if (hoursSinceClean > 24) return 'HOT';
      if (hoursSinceClean > 18) return 'WARM';
      return 'COOL';
      
    case 'mon_wed_full_clean':
      const lastMonday = getLastMonday(now);
      if (lastCleanedDate < lastMonday) return 'HOT';
      if (hoursSinceClean / 24 > 2) return 'WARM';
      return 'COOL';
      
    case 'vip':
      if (hoursSinceClean > 72) return 'HOT';
      if (hoursSinceClean > 48) return 'WARM';
      return 'COOL';
      
    case 'not_cleaned':
      return 'COOL';
      
    default:
      return isBeforeServiceDay(now) ? 'HOT' : 'COOL';
  }
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
    // Fetch event rooms for bookable rooms
    const eventRooms = await base44.asServiceRole.entities.PCO_EventRoom.list();
    
    // Filter for upcoming events
    const upcomingEventRooms = eventRooms.filter(er => {
      if (!er.start_time) return false;
      const startTime = new Date(er.start_time);
      const daysAhead = (startTime - now) / (1000 * 60 * 60 * 24);
      return daysAhead >= 0 && daysAhead <= 3; // Next 3 days
    });
    
    // Group by room and get next event per room
    const roomEventsByRoom = {};
    upcomingEventRooms.forEach(er => {
      if (!roomEventsByRoom[er.room_id] || new Date(er.start_time) < new Date(roomEventsByRoom[er.room_id].start_time)) {
        roomEventsByRoom[er.room_id] = {
          name: er.event_name,
          start_time: new Date(er.start_time)
        };
      }
    });
    
    // Map to output format
    roomIds.forEach(roomId => {
      if (roomEventsByRoom[roomId]) {
        roomEventMap[roomId] = roomEventsByRoom[roomId];
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

    // Batch fetch all events upfront
    const bookableRoomIds = rooms.filter(r => r.is_bookable).map(r => r.id);
    const nextEventMap = bookableRoomIds.length > 0 
      ? await getNextEventsBatch(base44, bookableRoomIds)
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

    // Compute warnings for all rooms with batching to avoid rate limits
    const warnings = [];
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < rooms.length; i += BATCH_SIZE) {
      const batch = rooms.slice(i, i + BATCH_SIZE);
      
      const batchWarnings = batch.map((room) => {
        const temperature = getRoomTemperature(room);
        
        if (temperature === 'COOL') return null;
        
        const acksForRoom = acksByRoom[room.id] || [];
        const lastCleanedDate = room.last_cleaned_at ? new Date(room.last_cleaned_at) : new Date(0);
        const activeAck = acksForRoom.find(ack => {
          const ackDate = new Date(ack.acknowledged_at);
          return ackDate > lastCleanedDate && !ack.auto_cleared;
        });
        
        if (activeAck) return null;
        
        let warningText = null;
        let eventTime = null;
        
        if (room.is_bookable) {
          const nextEvent = nextEventMap[room.id];
          if (!nextEvent) return null;
          
          const hoursUntilEvent = (nextEvent.start_time - new Date()) / (1000 * 60 * 60);
          
          if (hoursUntilEvent <= 24 && temperature !== 'COOL') {
            warningText = `Needs cleaned before ${nextEvent.name} on ${formatDate(nextEvent.start_time)}`;
            eventTime = nextEvent.start_time.toISOString();
          }
        } else {
          if (room.cleaning_schedule === 'not_cleaned') return null;
          
          if (!room.cleaning_schedule || room.cleaning_schedule === 'unknown') {
            if (isBeforeServiceDay(new Date()) && temperature === 'HOT') {
              warningText = "Needs cleaned before Wednesday night and Sunday morning services";
            }
          } else if (temperature === 'HOT') {
            warningText = `Behind cleaning schedule (${room.cleaning_schedule})`;
          }
        }
        
        if (!warningText) return null;
        
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
          warning_text: warningText,
          temperature: temperature,
          event_time: eventTime,
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