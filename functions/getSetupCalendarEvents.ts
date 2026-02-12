import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

  // Get resource requests for this event
  const resourceRequests = resourceMap[event.id] || [];

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
      setup_time_minutes: 60,
      teardown_time_minutes: 60
    });
  }

  return {
    event_id: event.id,
    event_name: event.attributes?.name || 'Unnamed Event',
    start_time: event.attributes?.starts_at,
    end_time: event.attributes?.ends_at,
    rooms: rooms.map(room => ({
      room_id: room.room_id,
      room_name: room.room_name,
      pco_resource_id: room.pco_resource_id
    }))
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

    // Fetch event instances for date range
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const eventsResponse = await fetchWithRetry(
      `https://api.planningcenteronline.com/calendar/v2/event_instances?where[starts_at][gte]=${startISO}&where[starts_at][lte]=${endISO}&include=event&per_page=100`,
      accessToken
    );

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const eventInstances = eventsData.data || [];

    // Build event lookup from instances (which have actual start/end times)
    const eventsLookup = {};
    for (const instance of eventInstances) {
      const eventId = instance.relationships?.event?.data?.id;
      if (eventId && !eventsLookup[eventId]) {
        // Store instance with its times
        eventsLookup[eventId] = {
          id: eventId,
          attributes: {
            name: instance.attributes?.name || 'Unnamed Event',
            starts_at: instance.attributes?.starts_at,
            ends_at: instance.attributes?.ends_at
          }
        };
      }
    }

    // Fetch resource requests for each event
    const resourceMap = {};

    for (const eventId of Object.keys(eventsLookup)) {
      const requestsResponse = await fetchWithRetry(
        `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`,
        accessToken
      );

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        const requests = [];

        for (const request of requestsData.data || []) {
          // Find resource in included
          const resourceData = (requestsData.included || []).find(
            i => i.type === 'Resource' && i.id === request.relationships?.resource?.data?.id
          );

          if (resourceData) {
            requests.push({
              resource_data: resourceData,
              quantity: request.attributes?.quantity || 1
            });
          }
        }

        resourceMap[eventId] = requests;
      }
    }

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

    // Load buildings and rooms for context
    const buildings = await base44.entities.Building.list();
    const rooms = await base44.entities.Room.list();
    const roomMap = {};
    const buildingMap = {};

    for (const room of rooms) {
      roomMap[room.id] = room;
    }

    for (const building of buildings) {
      buildingMap[building.id] = building;
    }

    // Create mapping from PCO resource ID to Room entity ID
    const pcoToRoomId = {};
    for (const room of rooms) {
      if (room.pco_resource_id) {
        pcoToRoomId[room.pco_resource_id] = room.id;
      }
    }

    // Build room-to-events mapping using entity IDs
    const roomEventsMap = {};
    for (const event of eventsWithSetup) {
      for (const room of event.rooms) {
        const entityRoomId = pcoToRoomId[room.room_id];
        if (!entityRoomId) continue;
        
        if (!roomEventsMap[entityRoomId]) {
          roomEventsMap[entityRoomId] = [];
        }
        // Store the event with only the relevant room setup info
        roomEventsMap[entityRoomId].push({
          event_id: event.event_id,
          event_name: event.event_name,
          start_time: event.start_time,
          end_time: event.end_time,
          setup_type: room.setup_type,
          setup_time_minutes: room.setup_time_minutes,
          teardown_time_minutes: room.teardown_time_minutes
        });
      }
    }

    // Organize response by building - Initialize all buildings and rooms
    const buildingData = {};

    // First pass: Initialize all buildings and rooms with empty events
    for (const building of buildings) {
      buildingData[building.id] = {
        building_id: building.id,
        building_name: building.name,
        rooms: {}
      };
      
      // Initialize all rooms in this building
      for (const room of rooms) {
        if (room.building_id === building.id) {
          buildingData[building.id].rooms[room.id] = {
            room_id: room.id,
            room_name: room.name,
            room_number: room.room_number,
            pco_resource_id: room.pco_resource_id,
            events: [],
            conflicts: []
          };
        }
      }
    }

    // Second pass: Populate events for rooms that have them
    for (const roomId of Object.keys(roomEventsMap)) {
      const roomEntity = roomMap[roomId];
      if (!roomEntity) continue;

      const buildingId = roomEntity.building_id;
      if (buildingData[buildingId]?.rooms[roomEntity.id]) {
        buildingData[buildingId].rooms[roomEntity.id].events = roomEventsMap[roomId];
      }
    }

    // Add conflicts to rooms
    for (const conflict of conflicts) {
      const roomEntity = roomMap[conflict.room_id];
      if (!roomEntity) continue;

      const buildingId = roomEntity.building_id;
      if (buildingData[buildingId]?.rooms[roomEntity.id]) {
        buildingData[buildingId].rooms[roomEntity.id].conflicts.push(conflict);
      }
    }

    // Convert to array and calculate stats
    const buildingsArray = Object.values(buildingData).map(building => ({
      ...building,
      rooms: Object.values(building.rooms),
      room_count: Object.values(building.rooms).length,
      event_count: Object.values(building.rooms).reduce((sum, r) => sum + r.events.length, 0),
      conflict_count: Object.values(building.rooms).reduce((sum, r) => sum + r.conflicts.length, 0)
    }))

    const totalEvents = buildingsArray.reduce((sum, b) => sum + b.event_count, 0);
    const totalConflicts = buildingsArray.reduce((sum, b) => sum + b.conflict_count, 0);
    const activeRooms = buildingsArray.reduce((sum, b) => sum + b.room_count, 0);

    return Response.json({
      success: true,
      summary: {
        total_events: totalEvents,
        total_conflicts: totalConflicts,
        active_rooms: activeRooms,
        date_range: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      },
      buildings: buildingsArray
    });

  } catch (error) {
    console.error('Error in getSetupCalendarEvents:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 200 });
  }
});