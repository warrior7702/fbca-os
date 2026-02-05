import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Determine alert level based on time until event
function getAlertLevel(hoursUntilEvent) {
  if (hoursUntilEvent <= 6) return 'ALERT';
  if (hoursUntilEvent <= 24) return 'NOTICE';
  return null;
}

// Get upcoming events from PCO Calendar API
async function getPCOEventsByRoom(base44, userEmail) {
  const roomEventMap = {};
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  try {
    // Get user's PCO token
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      console.error('[DEBUG] No PCO token for user:', userEmail);
      return roomEventMap;
    }
    
    // Check if token needs refresh
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    let pcoToken = user.pco_access_token;
    
    if (expiresAt <= fiveMinutesFromNow && user.pco_refresh_token) {
      console.log('[DEBUG] Refreshing PCO token...');
      const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.pco_refresh_token,
          client_id: Deno.env.get('PCO_CLIENT_ID') || '',
          client_secret: Deno.env.get('PCO_CLIENT_SECRET') || ''
        })
      });
      
      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        pcoToken = tokens.access_token;
        const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
        await base44.asServiceRole.entities.User.update(user.id, {
          pco_access_token: tokens.access_token,
          pco_refresh_token: tokens.refresh_token,
          pco_token_expires_at: newExpiresAt
        });
        console.log('[DEBUG] PCO token refreshed');
      }
    }

    const headers = { 'Authorization': `Bearer ${pcoToken}` };

    // Fetch event instances (next 24 hours)
    const instancesUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&order=starts_at&per_page=100`;
    const instancesResponse = await fetch(instancesUrl, { headers });
    
    if (!instancesResponse.ok) {
      console.error(`[DEBUG] PCO API error: ${instancesResponse.status}`);
      return roomEventMap;
    }
    
    const instancesData = await instancesResponse.json();
    const instances = instancesData.data || [];
    
    console.log(`[DEBUG] Fetched ${instances.length} event instances from PCO`);
    
    // Filter instances to next 24 hours and collect event IDs
    const eventIds = new Set();
    instances.forEach(instance => {
      const startsAt = new Date(instance.attributes?.starts_at);
      const hoursAhead = (startsAt - now) / (1000 * 60 * 60);
      
      if (hoursAhead >= 0 && hoursAhead <= 24) {
        const eventId = instance.relationships?.event?.data?.id;
        if (eventId) eventIds.add(eventId);
      }
    });
    
    console.log(`[DEBUG] Found ${eventIds.size} events in next 24 hours`);
    
    // Fetch resource requests for each event
    for (const eventId of eventIds) {
      try {
        const requestsUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`;
        const requestsResponse = await fetch(requestsUrl, { headers });
        
        if (!requestsResponse.ok) continue;
        
        const requestsData = await requestsResponse.json();
        const requests = requestsData.data || [];
        const included = requestsData.included || [];
        
        // Get event start time from the instance
        const instance = instances.find(i => i.relationships?.event?.data?.id === eventId);
        if (!instance) continue;
        
        const startsAt = new Date(instance.attributes.starts_at);
        const eventName = instance.attributes?.name || 'Unknown Event';
        
        // Map resources
        requests.forEach(request => {
          const resourceId = request.relationships?.resource?.data?.id;
          if (!resourceId) return;
          
          if (!roomEventMap[resourceId] || startsAt < new Date(roomEventMap[resourceId].start_time)) {
            roomEventMap[resourceId] = {
              name: eventName,
              start_time: startsAt.toISOString(),
              pco_room_id: resourceId
            };
          }
        });
        
      } catch (e) {
        console.error(`[DEBUG] Failed to fetch requests for event ${eventId}:`, e.message);
      }
    }
    
    console.log(`[DEBUG] Mapped ${Object.keys(roomEventMap).length} resources to events`);
    
  } catch (e) {
    console.error('[DEBUG] Failed to fetch events from PCO:', e.message);
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

    // Fetch events from PCO using authenticated user's token
    const pcoEventsByRoom = await getPCOEventsByRoom(base44, user.email);
    
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