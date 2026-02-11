// VERSION 4 - CACHE BUSTED
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FUNCTION_VERSION = "v4-fixed-empty-rooms";

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

function parseSetupRequirements(event, resourceMap) {
  const rooms = [];

  // Get resource requests for this event (or empty array if none)
  const resourceRequests = resourceMap[event.id] || [];

  // If event has bookable rooms, add them
  if (resourceRequests.length > 0) {
    for (const request of resourceRequests) {
      const resource = request.resource_data;
      if (!resource) continue;

      // Extract setup type from event questions or default to "Standard"
      let setupType = 'Standard';
      if (event.attributes?.custom_data) {
        try {
          const customData = JSON.parse(event.attributes.custom_data);
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
        setup_time_minutes: 60, // Default 60 minutes
        teardown_time_minutes: 60 // Default 60 minutes
      });
    }
  }

  return {
    event_id: event.id,
    event_name: event.attributes?.name || 'Unnamed Event',
    start_time: event.attributes?.starts_at,
    end_time: event.attributes?.ends_at,
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

    // Always fetch fresh data (caching disabled for now)

    // Fetch event instances for date range with resource requests included
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    
    console.time('Fetch all events with resources');

    // Step 1: Fetch ALL resources from PCO and filter by kind=Room
    let allRooms = [];
    let nextUrl = `https://api.planningcenteronline.com/calendar/v2/resources?per_page=100`;
    
    while (nextUrl) {
      const response = await fetchWithRetry(nextUrl, accessToken);
      if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.status}`);
      }
      const data = await response.json();
      allRooms = allRooms.concat(data.data || []);
      nextUrl = data.links?.next || null;
    }
    
    const bookableRooms = allRooms.filter(r => r.attributes?.kind === 'Room');
    const bookableRoomIds = new Set(bookableRooms.map(r => r.id));
    
    console.log('Total bookable rooms from PCO:', bookableRooms.length);

    // Step 2: Fetch ALL events with resource_requests included in single call
    console.log('Fetching events with resource requests included...');
    const eventsResponse = await fetchWithRetry(
      `https://api.planningcenteronline.com/calendar/v2/event_resource_requests?` +
      `filter=future&` +
      `where[starts_at][gte]=${startISO}&` +
      `where[starts_at][lte]=${endISO}&` +
      `include=event,resource&` +
      `per_page=100`,
      accessToken
    );

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch event resource requests: ${eventsResponse.status}`);
    }

    const resourceRequestsData = await eventsResponse.json();
    const allResourceRequests = resourceRequestsData.data || [];
    
    // Build maps from included data
    const eventsMap = {};
    const resourcesMap = {};
    
    for (const inc of resourceRequestsData.included || []) {
      if (inc.type === 'Event') {
        eventsMap[inc.id] = inc;
      } else if (inc.type === 'Resource') {
        resourcesMap[inc.id] = inc;
      }
    }
    
    console.log('Total resource requests fetched:', allResourceRequests.length);
    console.log('Total events included:', Object.keys(eventsMap).length);
    console.log('Total resources included:', Object.keys(resourcesMap).length);

    // Step 3: Build resourceMap grouped by event
    const resourceMap = {};
    let totalBookableMatches = 0;
    
    for (const request of allResourceRequests) {
      const eventId = request.relationships?.event?.data?.id;
      const resourceId = request.relationships?.resource?.data?.id;
      const resourceData = resourcesMap[resourceId];
      
      if (!eventId || !resourceData) continue;
      
      // Only include bookable rooms
      if (bookableRoomIds.has(resourceId)) {
        if (!resourceMap[eventId]) {
          resourceMap[eventId] = [];
        }
        
        resourceMap[eventId].push({
          resource_data: resourceData,
          quantity: request.attributes?.quantity || 1
        });
        
        totalBookableMatches++;
      }
    }
    
    const allEvents = Object.values(eventsMap);
    console.log('Events with bookable rooms:', Object.keys(resourceMap).length);

    // Debug: Show sample resource IDs from events
    if (Object.keys(resourceMap).length > 0) {
      const sampleEventId = Object.keys(resourceMap)[0];
      const sampleResources = resourceMap[sampleEventId];
      console.log(`\nSample event resource IDs from PCO:`);
      console.log(`  Event ID: ${sampleEventId}, Event: ${eventsMap[sampleEventId]?.attributes?.name}`);
      sampleResources.slice(0, 3).forEach(r => {
        console.log(`  - Resource ID: ${r.resource_data.id}, Name: ${r.resource_data.attributes?.name}`);
      });
    }

    // Build events lookup from events that have bookable room requests
    const eventsLookup = {};
    for (const event of allEvents) {
      if (resourceMap[event.id]) {
        eventsLookup[event.id] = event;
      }
    }

    console.log('Events with bookable room requests:', Object.keys(eventsLookup).length);
    console.timeEnd('Fetch all events with resources');

    // Parse setup requirements
    const eventsWithSetup = [];
    for (const eventId of Object.keys(eventsLookup)) {
      const event = eventsLookup[eventId];
      const parsed = parseSetupRequirements(event, { [eventId]: resourceMap[eventId] || [] });
      if (parsed.rooms.length > 0) {
        eventsWithSetup.push(parsed);
      }
    }

    // Detect conflicts
    const conflicts = detectSetupConflicts(eventsWithSetup);

    // Debug logging - v2 (force cache clear)
    console.log('=== SETUP CALENDAR DEBUG (v2) ===');
    console.log('Date range:', startISO, 'to', endISO);
    console.log('Total unique events:', Object.keys(eventsLookup).length);
    console.log('Events with bookable room requests:', Object.keys(resourceMap).length);
    console.log('Events with rooms after parsing:', eventsWithSetup.length);

    // If no events found, diagnose why
    if (Object.keys(eventsLookup).length === 0) {
      console.log('⚠️ NO EVENTS FOUND - Diagnostic:');
      console.log('- Total events fetched from PCO:', allEvents.length);
      console.log('- Total bookable rooms:', bookableRoomIds.size);
      console.log('- Sample bookable room IDs:', Array.from(bookableRoomIds).slice(0, 5));
    }

    // Load buildings and rooms for context
    const buildings = await base44.entities.Building.list();
    const allRoomsFromDB = await base44.entities.Room.list();
    
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

    // Create a map of PCO resource ID to room for fast lookup (with String conversion for type safety)
    const pcoIdToRoomMap = {};
    for (const room of allRooms) {
      if (room.pco_resource_id) {
        pcoIdToRoomMap[String(room.pco_resource_id)] = room;
      }
    }
    
    console.log('\n🔍 === PCO ID TO ROOM MAP ===');
    console.log(`Total rooms in map: ${Object.keys(pcoIdToRoomMap).length}`);
    const sampleMapEntries = Object.entries(pcoIdToRoomMap).slice(0, 3);
    sampleMapEntries.forEach(([pcoId, room]) => {
      console.log(`  - PCO ID: "${pcoId}" (type: ${typeof pcoId}) → Room: ${room.room_name || room.room_number}`);
    });

    // Initialize ALL buildings (even if no events)
    const buildingData = {};
    for (const building of buildings) {
      buildingData[building.id] = {
        building_id: building.id,
        building_name: building.name || 'Unknown Building',
        rooms: {}
      };
    }

    // DON'T add all rooms upfront - only add rooms when they have events
    // This prevents empty rooms from being included in the final output

    // Add events to rooms - DETAILED LOGGING
    console.log(`\n=== EVENT TO ROOM MATCHING ===`);
    console.log(`Total events to match: ${eventsWithSetup.length}`);
    
    let matchedRooms = 0;
    let unmatchedRooms = 0;
    const unmatchedPCOIds = new Set();
    const matchedEventIds = new Set();
    
    for (const event of eventsWithSetup) {
      let eventMatched = false;
      console.log(`\nProcessing event: ${event.event_name} (ID: ${event.event_id})`);
      console.log(`  - Event has ${event.rooms.length} rooms`);
      
      for (const room of event.rooms) {
        const pcoIdStr = String(room.pco_resource_id);
        console.log(`  - Checking room: ${room.room_name} (PCO ID: "${pcoIdStr}" type: ${typeof room.pco_resource_id})`);
        
        // Use the fast lookup map with String conversion
        const roomEntity = pcoIdToRoomMap[pcoIdStr];

        if (!roomEntity) {
          unmatchedRooms++;
          unmatchedPCOIds.add(room.pco_resource_id);
          console.log(`    ✗ NOT MATCHED - PCO ID not found in database`);
          continue;
        }

        console.log(`    ✓ MATCHED to database room: ${roomEntity.room_name || roomEntity.room_number} (ID: ${roomEntity.id}, Building: ${buildingMap[roomEntity.building_id]?.name})`);
        matchedRooms++;
        eventMatched = true;
        const buildingId = roomEntity.building_id;
        
        console.log(`    - Building ID: ${buildingId}, Building: ${buildingMap[buildingId]?.name}`);
        console.log(`    - buildingData exists: ${!!buildingData[buildingId]}`);
        
        // Create room if it doesn't exist (lazy initialization)
        if (buildingData[buildingId]) {
          if (!buildingData[buildingId].rooms[roomEntity.id]) {
            buildingData[buildingId].rooms[roomEntity.id] = {
              room_id: roomEntity.id,
              room_name: roomEntity.room_name,
              room_number: roomEntity.room_number,
              events: [],
              conflicts: []
            };
            console.log(`    ✓ Created room in buildingData`);
          }
          
          buildingData[buildingId].rooms[roomEntity.id].events.push(event);
          console.log(`    ✓ Event added to room's events array`);
        } else {
          console.log(`    ✗ FAILED - building not found in buildingData`);
        }
      }
      
      if (eventMatched) {
        matchedEventIds.add(event.event_id);
      }
    }
    
    console.log(`\n=== MATCHING SUMMARY ===`);
    console.log(`  - Total events processed: ${eventsWithSetup.length}`);
    console.log(`  - Events successfully matched: ${matchedEventIds.size}`);
    console.log(`  - Room matches: ${matchedRooms}`);
    console.log(`  - Room mismatches: ${unmatchedRooms}`);
    if (unmatchedPCOIds.size > 0) {
      console.log(`  - Sample unmatched PCO IDs:`, Array.from(unmatchedPCOIds).slice(0, 5));
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

    // Convert to array and calculate stats - FIXED VERSION v3
    console.log(`\n=== BUILDING DATA CONVERSION (v3 FIXED) ===`);
    const buildingsArray = [];
    
    for (const building of Object.values(buildingData)) {
      const allRoomsInBuilding = Object.values(building.rooms);
      
      // CRITICAL FIX: Only include rooms that actually have events
      const roomsWithEvents = allRoomsInBuilding.filter(room => room.events && room.events.length > 0);
      
      console.log(`Building: ${building.building_name}`);
      console.log(`  - All rooms in structure: ${allRoomsInBuilding.length}`);
      console.log(`  - Rooms WITH events: ${roomsWithEvents.length}`);
      
      // Skip buildings with no rooms that have events
      if (roomsWithEvents.length === 0) {
        console.log(`  - Skipping (no rooms with events)`);
        continue;
      }
      
      const eventCount = roomsWithEvents.reduce((sum, r) => sum + r.events.length, 0);
      const conflictCount = roomsWithEvents.reduce((sum, r) => sum + r.conflicts.length, 0);
      
      console.log(`  - Total events: ${eventCount}`);
      roomsWithEvents.slice(0, 3).forEach(r => {
        console.log(`    - ${r.room_name || r.room_number}: ${r.events.length} events`);
      });
      
      console.log(`  - ✅ PUSHING TO ARRAY: ${building.building_name} with ${roomsWithEvents.length} rooms`);
      buildingsArray.push({
        building_id: building.building_id,
        building_name: building.building_name,
        rooms: roomsWithEvents,
        room_count: roomsWithEvents.length,
        event_count: eventCount,
        conflict_count: conflictCount
      });
    }

    console.log(`\n=== FINAL BUILDING ARRAY ===`);
    console.log('Total buildings:', buildingsArray.length);
    buildingsArray.forEach(b => {
      console.log(`  - ${b.building_name}: ${b.event_count} events, ${b.room_count} rooms with events`);
      console.log(`    Sample rooms:`, b.rooms.slice(0, 2).map(r => ({
        id: r.room_id,
        name: r.room_name || r.room_number,
        events: r.events.length
      })));
    });

    const totalEvents = buildingsArray.reduce((sum, b) => sum + b.event_count, 0);
    const totalConflicts = buildingsArray.reduce((sum, b) => sum + b.conflict_count, 0);
    const roomsWithEvents = buildingsArray.reduce((sum, b) => 
      sum + b.rooms.filter(r => r.events.length > 0).length, 0
    );

    const result = {
      success: true,
      summary: {
        total_events: totalEvents,
        total_conflicts: totalConflicts,
        rooms_with_events: roomsWithEvents,
        date_range: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
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