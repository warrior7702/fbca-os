import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get last Monday from a given date
function getLastMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // If Sunday, go back 6 days, else go back to Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Check if date is before a service day (Tues or Sat)
function isBeforeServiceDay(date) {
  const day = date.getDay();
  // Tuesday (2) or Saturday (6)
  return day === 2 || day === 6;
}

// Main temperature calculation function
export function getRoomTemperature(room) {
  const schedule = room.cleaning_schedule;
  const lastCleaned = room.last_cleaned_at;
  const now = new Date();
  
  // Never cleaned = HOT
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
      // For unassigned or unknown schedules
      return isBeforeServiceDay(now) ? 'HOT' : 'COOL';
  }
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

    // Fetch room
    const rooms = await base44.entities.Room.filter({ id: room_id });
    if (!rooms || rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];
    const temperature = getRoomTemperature(room);

    return Response.json({
      success: true,
      room_id: room.id,
      room_name: room.room_name,
      room_number: room.room_number,
      cleaning_schedule: room.cleaning_schedule,
      last_cleaned_at: room.last_cleaned_at,
      temperature,
      hours_since_clean: room.last_cleaned_at 
        ? Math.round((new Date() - new Date(room.last_cleaned_at)) / (1000 * 60 * 60))
        : null
    });

  } catch (error) {
    console.error('getRoomTemperature error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});