import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Determine alert level based on time until event
function getAlertLevel(hoursUntilEvent) {
  if (hoursUntilEvent <= 6) return 'ALERT';
  if (hoursUntilEvent <= 24) return 'NOTICE';
  return null;
}

// Get upcoming events from PCO API
async function getPCOEventsByRoom(base44) {
  const roomEventMap = {};
  const now = new Date();
  
  try {
    // Get PCO access token using SDK
    let pcoToken;
    try {
      const tokenResponse = await base44.functions.invoke('getPCOToken', {});
      pcoToken = tokenResponse.data?.access_token;
    } catch (e) {
      console.error('Failed to get PCO token:', e.message);
      return roomEventMap;
    }
    
    if (!pcoToken) {
      console.error('No valid PCO token available');
      return roomEventMap;
    }

    // Query PCO API for events in next 24 hours
    const url = `https://api.planningcenteronline.com/services/v2/events?filter=future&order=-starts_at&per_page=100`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${pcoToken}` }
    });
    
    if (!response.ok) {
      console.error(`PCO API error: ${response.status}`);
      return roomEventMap;
    }
    
    const data = await response.json();
    const events = data.data || [];
    console.log(`[DEBUG] Fetched ${events.length} events from PCO API`);
    
    // For each event, fetch its room bookings
    for (const event of events) {
      const startsAt = new Date(event.attributes.starts_at);
      const hoursAhead = (startsAt - now) / (1000 * 60 * 60);
      
      // Only consider events in next 24 hours
      if (hoursAhead < 0 || hoursAhead > 24) continue;
      
      try {
        // Get room bookings for this event
        const roomsUrl = `https://api.planningcenteronline.com/services/v2/events/${event.id}/event_instances/0/event_times/0/room_setups`;
        const roomsResponse = await fetch(roomsUrl, {
          headers: { 'Authorization': `Bearer ${pcoToken}` }
        });
        
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json();
          const rooms = roomsData.data || [];
          
          rooms.forEach(room => {
            const roomId = room.relationships?.room?.data?.id;
            if (roomId) {
              roomEventMap[roomId] = {
                name: event.attributes.name,
                start_time: startsAt.toISOString(),
                pco_room_id: roomId
              };
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to get rooms for event ${event.id}:`, e.message);
      }
    }
    
    console.log(`[DEBUG] Found ${Object.keys(roomEventMap).length} rooms with events in next 24 hours`);
    
  } catch (e) {
    console.error('Failed to fetch events from PCO API:', e.message);
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