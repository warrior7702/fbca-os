import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshPCOToken(base44, user) {
  const expiresAt = new Date(user.pco_expires_at);
  const now = new Date();
  const bufferMinutes = 10;
  
  if (expiresAt - now < bufferMinutes * 60 * 1000) {
    const response = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: user.pco_refresh_token,
        client_id: Deno.env.get('PCO_CLIENT_ID'),
        client_secret: Deno.env.get('PCO_CLIENT_SECRET')
      })
    });
    
    if (!response.ok) throw new Error('Failed to refresh PCO token');
    
    const tokens = await response.json();
    await base44.auth.updateMe({
      pco_access_token: tokens.access_token,
      pco_refresh_token: tokens.refresh_token,
      pco_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.pco_access_token;
}

async function fetchPCOData(accessToken, url) {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`PCO API error: ${response.status}`);
  }
  
  return await response.json();
}

function getDateString(date) {
  return date.toISOString().split('T')[0];
}

function getMinutesOverlap(eventStart, eventEnd, dayStart, dayEnd) {
  const start = Math.max(eventStart.getTime(), dayStart.getTime());
  const end = Math.min(eventEnd.getTime(), dayEnd.getTime());
  
  if (end <= start) return 0;
  
  return (end - start) / 60000;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.pco_access_token) {
      return Response.json({ 
        success: false, 
        error: 'PCO not connected' 
      });
    }
    
    const body = await req.json().catch(() => ({}));
    const { 
      days = 14,
      heavy_usage_threshold_minutes = 360,
      conflict_gap_minutes = 60
    } = body;
    
    const accessToken = await refreshPCOToken(base44, user);
    
    // Calculate date range
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    
    const startStr = now.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // Fetch event instances
    const eventsUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=starts_at&where[starts_at][gte]=${startStr}&where[starts_at][lte]=${endStr}&per_page=100&include=event,resource_bookings`;
    const eventsData = await fetchPCOData(accessToken, eventsUrl);
    
    // Fetch bookable rooms
    const roomsUrl = 'https://api.planningcenteronline.com/calendar/v2/resources?where[resource_type]=Room&per_page=100';
    const roomsData = await fetchPCOData(accessToken, roomsUrl);
    
    const bookableRooms = new Map();
    for (const room of roomsData.data || []) {
      const isBookable = room.attributes?.bookable !== false;
      if (isBookable) {
        bookableRooms.set(room.id, {
          id: room.id,
          name: room.attributes.name
        });
      }
    }
    
    // Build room-day map
    const roomDayMap = new Map();
    
    // Generate all dates in range
    const allDates = [];
    for (let d = new Date(now); d < endDate; d.setDate(d.getDate() + 1)) {
      allDates.push(getDateString(new Date(d)));
    }
    
    // Initialize map for all bookable rooms and dates
    for (const [roomId, room] of bookableRooms) {
      for (const date of allDates) {
        const key = `${roomId}:${date}`;
        roomDayMap.set(key, {
          room_pco_resource_id: roomId,
          room_name: room.name,
          room_is_bookable: true,
          date,
          minutes_booked: 0,
          booking_count: 0,
          peak_conflicts: 0,
          bookings: []
        });
      }
    }
    
    // Process events
    for (const instance of eventsData.data || []) {
      const startsAt = new Date(instance.attributes.starts_at);
      const endsAt = new Date(instance.attributes.ends_at);
      
      // Get resource bookings
      const bookings = eventsData.included?.filter(i => 
        i.type === 'ResourceBooking' && 
        i.relationships?.event_instance?.data?.id === instance.id
      ) || [];
      
      for (const booking of bookings) {
        const resourceId = booking.relationships?.resource?.data?.id;
        
        // Only process bookable rooms
        if (!bookableRooms.has(resourceId)) continue;
        
        // Calculate overlap for each date
        for (const date of allDates) {
          const dayStart = new Date(date + 'T00:00:00');
          const dayEnd = new Date(date + 'T23:59:59.999');
          
          const minutesOverlap = getMinutesOverlap(startsAt, endsAt, dayStart, dayEnd);
          
          if (minutesOverlap > 0) {
            const key = `${resourceId}:${date}`;
            const data = roomDayMap.get(key);
            
            if (data) {
              data.minutes_booked += minutesOverlap;
              data.booking_count += 1;
              data.bookings.push({
                starts_at: startsAt.toISOString(),
                ends_at: endsAt.toISOString()
              });
            }
          }
        }
      }
    }
    
    // Calculate peak conflicts (back-to-back bookings with gap < threshold)
    for (const [key, data] of roomDayMap) {
      if (data.bookings.length < 2) continue;
      
      // Sort bookings by start time
      const sortedBookings = data.bookings.sort((a, b) => 
        new Date(a.starts_at) - new Date(b.starts_at)
      );
      
      let conflicts = 0;
      for (let i = 0; i < sortedBookings.length - 1; i++) {
        const currentEnd = new Date(sortedBookings[i].ends_at);
        const nextStart = new Date(sortedBookings[i + 1].starts_at);
        
        const gapMinutes = (nextStart - currentEnd) / 60000;
        
        if (gapMinutes < conflict_gap_minutes) {
          conflicts++;
        }
      }
      
      data.peak_conflicts = conflicts;
    }
    
    // Upsert to RoomOccupancyDaily
    let recordsUpserted = 0;
    
    for (const [key, data] of roomDayMap) {
      // Check if record exists
      const existing = await base44.entities.RoomOccupancyDaily.filter({
        date: data.date,
        room_pco_resource_id: data.room_pco_resource_id
      });
      
      const recordData = {
        date: data.date,
        room_pco_resource_id: data.room_pco_resource_id,
        room_name: data.room_name,
        room_is_bookable: data.room_is_bookable,
        minutes_booked: Math.round(data.minutes_booked),
        booking_count: data.booking_count,
        peak_conflicts: data.peak_conflicts
      };
      
      if (existing.length > 0) {
        await base44.entities.RoomOccupancyDaily.update(existing[0].id, recordData);
      } else {
        await base44.entities.RoomOccupancyDaily.create(recordData);
      }
      
      recordsUpserted++;
    }
    
    const durationMs = Date.now() - startTime;
    
    return Response.json({
      success: true,
      records_upserted: recordsUpserted,
      rooms_count: bookableRooms.size,
      days,
      duration_ms: durationMs
    });
    
  } catch (error) {
    console.error('computeRoomHeatmap error:', error);
    return Response.json({
      success: false,
      error: error.message,
      duration_ms: Date.now() - startTime
    });
  }
});