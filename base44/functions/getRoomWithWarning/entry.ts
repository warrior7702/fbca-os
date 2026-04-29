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
  
  const events = await base44.asServiceRole.entities.PCO_EventRoom.filter({
    room_id: roomId
  });
  
  if (!events || events.length === 0) return null;
  
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
  
  if (futureEvents.length === 0) return null;
  futureEvents.sort((a, b) => a.start_time - b.start_time);
  return futureEvents[0];
}

// Compute cleaning warnings
async function computeCleaningWarnings(base44, room) {
  const temperature = getRoomTemperature(room);
  
  if (temperature === 'COOL') return null;
  
  const latestAck = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
    room_id: room.id,
    auto_cleared: false
  });
  
  const lastCleanedDate = room.last_cleaned_at ? new Date(room.last_cleaned_at) : new Date(0);
  const activeAck = latestAck.find(ack => {
    const ackDate = new Date(ack.acknowledged_at);
    return ackDate > lastCleanedDate;
  });
  
  if (activeAck) return null;
  
  if (room.is_bookable) {
    const nextEvent = await getNextEvent(base44, room.id);
    if (!nextEvent) return null;
    
    const hoursUntilEvent = (nextEvent.start_time - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilEvent <= 24 && temperature !== 'COOL') {
      return {
        text: `Needs cleaned before ${nextEvent.name} on ${formatDate(nextEvent.start_time)}`,
        temperature: temperature
      };
    }
  } else {
    if (room.cleaning_schedule === 'not_cleaned') return null;
    
    if (!room.cleaning_schedule || room.cleaning_schedule === 'unknown') {
      if (isBeforeServiceDay(new Date()) && temperature === 'HOT') {
        return {
          text: "Needs cleaned before Wednesday night and Sunday morning services",
          temperature: 'HOT'
        };
      }
    } else if (temperature === 'HOT') {
      return {
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const roomId = pathParts[pathParts.length - 1];

    if (!roomId) {
      return Response.json({ error: 'room_id required' }, { status: 400 });
    }

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (!rooms || rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];
    const cleaning_warning = await computeCleaningWarnings(base44, room);

    return Response.json({
      ...room,
      cleaning_warning
    });

  } catch (error) {
    console.error('getRoomWithWarning error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});