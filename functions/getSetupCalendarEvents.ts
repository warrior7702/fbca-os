// ===================================
// VERSION 6 - EVENT INSTANCES API
// ===================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FUNCTION_VERSION = "v6-event-instances";

async function refreshTokenIfNeeded(base44, user) {
  const expiresAt = new Date(user.pco_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return user.pco_access_token;
  }

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

  if (!tokenResponse.ok) throw new Error('Token refresh failed');

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

  await base44.asServiceRole.entities.User.update(user.id, {
    pco_access_token: tokens.access_token,
    pco_refresh_token: tokens.refresh_token,
    pco_token_expires_at: newExpiresAt
  });

  return tokens.access_token;
}

async function fetchWithRetry(url, accessToken, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 429) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}

function parseSetupRequirements(eventInstance, roomBookings) {
  const rooms = [];

  for (const booking of roomBookings) {
    const resource = booking.resource_data;
    if (!resource || resource.attributes?.kind !== 'Room') continue;

    // Extract setup type from event questions or default to "Standard"
    let setupType = 'Standard';
    if (eventInstance.attributes?.custom_data) {
      try {
        const customData = JSON.parse(eventInstance.attributes.custom_data);
        setupType = customData.setup_type || 'Standard';
      } catch (e) {
        // Use default
      }
    }

    rooms.push({
      room_id: resource.id,
      room_name: resource.attributes?.name || 'Unknown',
      pco_resource_id: resource.id,
      setup_type: setupType,
      setup_time_minutes: 60,
      teardown_time_minutes: 60
    });
  }

  return {
    event_id: eventInstance.relationships?.event?.data?.id || eventInstance.id,
    event_name: eventInstance.attributes?.name || 'Unnamed Event',
    start_time: eventInstance.attributes?.starts_at,
    end_time: eventInstance.attributes?.ends_at,
    rooms
  };
}

function detectSetupConflicts(eventsWithSetup) {
  const conflicts = [];
  const roomEvents = {};

  // Group events by room
  for (const event of eventsWithSetup) {
    for (const room of event.rooms) {
      if (!roomEvents[room.room_id]) {
        roomEvents[room.room_id] = [];
      }
      roomEvents[room.room_id].push({
        ...event,
        room
      });
    }
  }

  // Sort by start time and detect conflicts
  for (const [roomId, events] of Object.entries(roomEvents)) {
    const sorted = events.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const event1 = sorted[i];
      const event2 = sorted[i + 1];

      const event1End = new Date(event1.end_time).getTime();
      const event2Start = new Date(event2.start_time).getTime();
      const gap = Math.floor((event2Start - event1End) / 60000); // minutes

      const required = event1.room.teardown_time_minutes + event2.room.setup_time_minutes;

      if (gap < required) {
        conflicts.push({
          room_id: roomId,
          room_name: event1.room.room_name,
          event1: {
            event_id: event1.event_id,
            event_name: event1.event_name,
            start_time: event1.start_time,
            end_time: event1.end_time
          },
          event2: {
            event_id: event2.event_id,
            event_name: event2.event_name,
            start_time: event2.start_time,
            end_time: event2.end_time
          },
          gap_minutes: gap,
          required_minutes: required,
          shortage_minutes: required - gap
        });
      }
    }
  }

  return conflicts;
}

Deno.serve(async (req) => {
  try {
    console.log(`🚀 RUNNING VERSION: ${FUNCTION_VERSION}`);
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record with PCO tokens
    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    // Parse query params
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const buildingId = url.searchParams.get('building_id');

    // Default to next 14 days
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    const accessToken = await refreshTokenIfNeeded(base44, user);

    const startISO = start.toISOString();
    const endISO = end.toISOString();
    
    console.time('Fetch event instances with resource bookings');

    // Fetch event instances with resource_bookings
    let eventInstances = [];
    let nextUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?` +
      `where[starts_at][gte]=${startISO}&` +
      `where[starts_at][lte]=${endISO}&` +
      `include=event,resource_bookings,resource_bookings.resource&` +
      `per_page=100`;
    
    while (nextUrl) {
      const response = await fetchWithRetry(nextUrl, accessToken);
      if (!response.ok) {
        throw new Error(`Failed to fetch event instances: ${response.status}`);
      }
      const data = await response.json();
      eventInstances = eventInstances.concat(data.data || []);
      nextUrl = data.links?.next || null;
    }

    console.log('Total event instances fetched:', eventInstances.length);

    // Build maps from included data
    const resourceBookingsMap = {};
    const resourcesMap = {};
    const eventsMap = {};
    
    for (const inc of eventInstances.flatMap(ei => ei.included || [])) {
      if (inc.type === 'ResourceBooking') {
        const instanceId = inc.relationships?.event_instance?.data?.id;
        if (instanceId) {
          if (!resourceBookingsMap[instanceId]) {
            resourceBookingsMap[instanceId] = [];
          }
          resourceBookingsMap[instanceId].push(inc);
        }
      } else if (inc.type === 'Resource') {
        resourcesMap[inc.id] = inc;
      } else if (inc.type === 'Event') {
        eventsMap[inc.id] = inc;
      }
    }

    console.log('Total resource bookings:', Object.values(resourceBookingsMap).flat().length);
    console.log('Total resources:', Object.keys(resourcesMap).length);

    // Parse setup requirements
    const eventsWithSetup = [];
    for (const instance of eventInstances) {
      const bookings = resourceBookingsMap[instance.id] || [];
      const roomBookings = bookings
        .map(booking => ({
          ...booking,
          resource_data: resourcesMap[booking.relationships?.resource?.data?.id]
        }))
        .filter(b => b.resource_data?.attributes?.kind === 'Room');

      if (roomBookings.length > 0) {
        const parsed = parseSetupRequirements(instance, roomBookings);
        if (parsed.rooms.length > 0) {
          eventsWithSetup.push(parsed);
        }
      }
    }

    console.log('Events with room bookings:', eventsWithSetup.length);
    console.timeEnd('Fetch event instances with resource bookings');

    // Detect conflicts
    const conflicts = detectSetupConflicts(eventsWithSetup);

    // Load buildings and rooms using service role
    const buildings = await base44.asServiceRole.entities.Building.list();
    const allRoomsFromDB = await base44.asServiceRole.entities.Room.list();
    
    // Filter to only PCO-bookable rooms
    const allRooms = allRoomsFromDB.filter(r => r.pco_resource_id);
    console.log(`Filtered to ${allRooms.length} PCO-bookable rooms (out of ${allRoomsFromDB.length} total)`);
    
    const buildingMap = {};

    for (const building of buildings) {
      buildingMap[building.id] = building;
    }

    // Debug: Show sample room pco_resource_ids from database
    const roomsWithPCOId = allRooms.filter(r => r.pco_resource_id);
    console.log(`\nDatabase rooms with pco_resource_id: ${roomsWithPCOId.length} of ${allRooms.length}`);
    if (roomsWithPCOId.length > 0) {
      console.log(`Sample database room pco_resource_ids:`);
      roomsWithPCOId.slice(0, 5).forEach(r => {
        console.log(`  - PCO ID: ${r.pco_resource_id}, Room: ${r.room_name || r.room_number}, Building: ${buildingMap[r.building_id]?.name}`);
      });
    } else {
      console.log(`⚠️ NO ROOMS have pco_resource_id set in database!`);
    }

    // Create a Map of PCO resource ID to room for fast lookup
    const pcoIdToRoomMap = new Map(
      allRooms
        .filter(r => r.pco_resource_id)
        .map(r => [String(r.pco_resource_id), r])
    );
    
    console.log('\n🔍 === PCO ID TO ROOM MAP ===');
    console.log(`Total rooms in map: ${pcoIdToRoomMap.size}`);

    // Initialize building structure
    const buildingData = {};
    for (const building of buildings) {
      buildingData[building.id] = {
        building_id: building.id,
        building_name: building.name || 'Unknown Building',
        rooms: {}
      };
    }

    // Add events to rooms
    for (const event of eventsWithSetup) {
      for (const room of event.rooms) {
        const pcoIdStr = String(room.pco_resource_id);
        const roomEntity = pcoIdToRoomMap.get(pcoIdStr);

        if (!roomEntity) continue;

        const buildingId = roomEntity.building_id;
        
        if (buildingData[buildingId]) {
          if (!buildingData[buildingId].rooms[roomEntity.id]) {
            buildingData[buildingId].rooms[roomEntity.id] = {
              room_id: roomEntity.id,
              room_name: roomEntity.room_name,
              room_number: roomEntity.room_number,
              events: [],
              conflicts: []
            };
          }
          
          buildingData[buildingId].rooms[roomEntity.id].events.push(event);
        }
      }
    }

    // Add conflicts to rooms (only if room exists in buildingData)
    for (const conflict of conflicts) {
      const roomEntity = allRooms.find(r => r.id === conflict.room_id);
      if (!roomEntity) continue;

      const buildingId = roomEntity.building_id;
      // Room should already exist if it has events
      if (buildingData[buildingId]?.rooms[conflict.room_id]) {
        buildingData[buildingId].rooms[conflict.room_id].conflicts.push(conflict);
      }
    }

    // Convert to array - only include buildings and rooms with events
    const buildingsArray = [];
    
    for (const building of Object.values(buildingData)) {
      const roomsWithEvents = Object.values(building.rooms).filter(room => room.events.length > 0);
      
      if (roomsWithEvents.length === 0) continue;
      
      const eventCount = roomsWithEvents.reduce((sum, r) => sum + r.events.length, 0);
      const conflictCount = roomsWithEvents.reduce((sum, r) => sum + r.conflicts.length, 0);
      
      buildingsArray.push({
        building_id: building.building_id,
        building_name: building.building_name,
        rooms: roomsWithEvents,
        room_count: roomsWithEvents.length,
        event_count: eventCount,
        conflict_count: conflictCount
      });
    }

    const totalEvents = buildingsArray.reduce((sum, b) => sum + b.event_count, 0);
    const totalConflicts = buildingsArray.reduce((sum, b) => sum + b.conflict_count, 0);
    const roomsWithEventsCount = buildingsArray.reduce((sum, b) => sum + b.room_count, 0);

    const responseVersion = new Date().toISOString();

    const result = {
      success: true,
      version: responseVersion,
      summary: {
        total_events: totalEvents,
        total_conflicts: totalConflicts,
        rooms_with_events: roomsWithEventsCount,
        buildings_with_events: buildingsArray.length,
        date_range: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      },
      debug: {
        function_version: FUNCTION_VERSION,
        rooms_from_db: allRoomsFromDB.length,
        rooms_with_pco_id: pcoIdToRoomMap.size,
        events_fetched: eventInstances.length,
        rooms_with_events: roomsWithEventsCount
      },
      buildings: buildingsArray
    };

    return Response.json(result);

  } catch (error) {
    console.error('Error in getSetupCalendarEvents:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 200 });
  }
});