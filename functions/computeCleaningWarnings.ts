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

// Get next event for a bookable room
async function getNextEvent(base44, roomId) {
  const now = new Date();
  
  // Get PCO events for this room that start in the future
  const events = await base44.asServiceRole.entities.PCO_EventRoom.filter({
    room_id: roomId
  });
  
  if (!events || events.length === 0) return null;
  
  // Get the event details and filter for future events
  const futureEvents = [];
  for (const eventRoom of events) {
    const eventDetails = await base44.asServiceRole.entities.PCO_Event.filter({
      id: eventRoom.event_id
    });
    
    if (eventDetails && eventDetails.length > 0) {
      const event = eventDetails[0];
      const startTime = new Date(event.starts_at);
      if (startTime > now) {
        futureEvents.push({
          name: event.name,
          start_time: startTime,
          end_time: event.ends_at ? new Date(event.ends_at) : null
        });
      }
    }
  }
  
  // Sort by start time and return the earliest
  if (futureEvents.length === 0) return null;
  futureEvents.sort((a, b) => a.start_time - b.start_time);
  return futureEvents[0];
}

// Main function
export async function computeCleaningWarnings(base44, roomId) {
  const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
  if (!rooms || rooms.length === 0) return null;
  
  const room = rooms[0];
  const temperature = getRoomTemperature(room);
  
  // Cool rooms don't need warnings
  if (temperature === 'COOL') return null;
  
  // Check if already acknowledged
  const latestAck = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
    room_id: roomId,
    auto_cleared: false
  });
  
  // Filter acknowledgments that are newer than last cleaning
  const lastCleanedDate = room.last_cleaned_at ? new Date(room.last_cleaned_at) : new Date(0);
  const activeAck = latestAck.find(ack => {
    const ackDate = new Date(ack.acknowledged_at);
    return ackDate > lastCleanedDate;
  });
  
  if (activeAck) return null; // Already acknowledged
  
  // Bookable rooms
  if (room.is_bookable) {
    const nextEvent = await getNextEvent(base44, roomId);
    if (!nextEvent) return null;
    
    const hoursUntilEvent = (nextEvent.start_time - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilEvent <= 24 && temperature !== 'COOL') {
      return {
        room_id: roomId,
        text: `Needs cleaned before ${nextEvent.name} on ${formatDate(nextEvent.start_time)}`,
        temperature: temperature,
        event_time: nextEvent.start_time.toISOString(),
        auto_clear_at: nextEvent.end_time 
          ? nextEvent.end_time.toISOString() 
          : addHours(nextEvent.start_time, 2).toISOString()
      };
    }
  } else {
    // Non-bookable rooms
    if (room.cleaning_schedule === 'not_cleaned') return null;
    
    if (!room.cleaning_schedule || room.cleaning_schedule === 'unknown') {
      if (isBeforeServiceDay(new Date()) && temperature === 'HOT') {
        return {
          room_id: roomId,
          text: "Needs cleaned before Wednesday night and Sunday morning services",
          temperature: 'HOT'
        };
      }
    } else if (temperature === 'HOT') {
      return {
        room_id: roomId,
        text: `Behind cleaning schedule (${room.cleaning_schedule})`,
        temperature: 'HOT'
      };
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { room_id } = await req.json();

    if (!room_id) {
      return Response.json({ error: 'room_id required' }, { status: 400 });
    }

    const warning = await computeCleaningWarnings(base44, room_id);

    return Response.json({
      success: true,
      room_id,
      warning
    });

  } catch (error) {
    console.error('computeCleaningWarnings error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});