import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cache for 5 minutes to avoid repeated API calls
let cachedResult = null;
let cacheTime = null;
const CACHE_TTL = 5 * 60 * 1000;

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

    // Check cache first
    const cacheKey = `${start.toISOString()}_${end.toISOString()}`;
    const forceFresh = url.searchParams.get('refresh') === 'true';
    
    if (!forceFresh && cachedResult && cacheTime && (Date.now() - cacheTime < CACHE_TTL)) {
      console.log('Returning cached events (age:', Math.round((Date.now() - cacheTime) / 1000), 'seconds)');
      return Response.json(cachedResult);
    }

    // Fetch event instances for date range with resource requests included
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    
    console.time('Fetch all events with resources');

    // OPTIMIZED: Fetch events - PCO doesn't support nested includes, so we fetch events first
    const eventsResponse = await fetchWithRetry(
      `https://api.planningcenteronline.com/calendar/v2/event_instances?` +
      `where[starts_at][gte]=${startISO}&` +
      `where[starts_at][lte]=${endISO}&` +
      `include=event&` +
      `per_page=100`,
      accessToken
    );

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const eventInstances = eventsData.data || [];
    
    console.log('API Response - Event Instances:', eventInstances.length);
    console.log('API Response - Included records:', eventsData.included?.length || 0);

    // Build lookup maps from included data
    const eventsLookup = {};
    const resourceRequestsMap = {};
    const resourcesMap = {};

    for (const included of eventsData.included || []) {
      if (included.type === 'Event') {
        eventsLookup[included.id] = included;
      } else if (included.type === 'ResourceRequest') {
        const eventId = included.relationships?.event?.data?.id;
        if (eventId) {
          if (!resourceRequestsMap[eventId]) {
            resourceRequestsMap[eventId] = [];
          }
          resourceRequestsMap[eventId].push(included);
        }
      } else if (included.type === 'Resource') {
        resourcesMap[included.id] = included;
      }
    }

    console.log('Parsed Events:', Object.keys(eventsLookup).length);
    console.log('Events with resource requests:', Object.keys(resourceRequestsMap).length);
    console.log('Total resources:', Object.keys(resourcesMap).length);

    // Build resource map with full resource data
    const resourceMap = {};
    for (const [eventId, requests] of Object.entries(resourceRequestsMap)) {
      resourceMap[eventId] = requests.map(req => {
        const resourceId = req.relationships?.resource?.data?.id;
        return {
          resource_data: resourcesMap[resourceId],
          quantity: req.attributes?.quantity || 1
        };
      }).filter(r => r.resource_data); // Only include requests with valid resources
    }

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

    // Debug logging
    console.log('=== SETUP CALENDAR DEBUG ===');
    console.log('Date range:', startISO, 'to', endISO);
    console.log('Total event instances fetched:', eventInstances.length);
    console.log('Total unique events:', Object.keys(eventsLookup).length);
    console.log('Events with resource requests:', Object.keys(resourceMap).filter(id => resourceMap[id].length > 0).length);
    console.log('Events with rooms after parsing:', eventsWithSetup.length);
    
    // Log sample of events with no resources
    const eventsWithoutResources = Object.keys(eventsLookup).filter(id => !resourceMap[id] || resourceMap[id].length === 0);
    if (eventsWithoutResources.length > 0) {
      console.log('Events WITHOUT resource requests:', eventsWithoutResources.length);
      console.log('Sample event names without resources:', eventsWithoutResources.slice(0, 3).map(id => eventsLookup[id]?.attributes?.name));
    }

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

    // Initialize ALL buildings (even if no events)
    const buildingData = {};
    for (const building of buildings) {
      buildingData[building.id] = {
        building_id: building.id,
        building_name: building.name || 'Unknown Building',
        rooms: {}
      };
    }

    // Add all rooms to their buildings
    for (const room of rooms) {
      const buildingId = room.building_id;
      if (buildingData[buildingId]) {
        buildingData[buildingId].rooms[room.id] = {
          room_id: room.id,
          room_name: room.name,
          room_number: room.room_number,
          events: [],
          conflicts: []
        };
      }
    }

    // Add events to rooms
    for (const event of eventsWithSetup) {
      for (const room of event.rooms) {
        const roomEntity = Object.values(roomMap).find(r => 
          r.pco_resource_id === room.pco_resource_id
        );

        if (!roomEntity) continue;

        const buildingId = roomEntity.building_id;
        if (buildingData[buildingId]?.rooms[roomEntity.id]) {
          buildingData[buildingId].rooms[roomEntity.id].events.push(event);
        }
      }
    }

    // Add conflicts to rooms
    for (const conflict of conflicts) {
      const roomEntity = Object.values(roomMap).find(r => r.id === conflict.room_id);
      if (!roomEntity) continue;

      const buildingId = roomEntity.building_id;
      if (buildingData[buildingId]?.rooms[conflict.room_id]) {
        buildingData[buildingId].rooms[conflict.room_id].conflicts.push(conflict);
      }
    }

    // Convert to array and calculate stats
    const buildingsArray = Object.values(buildingData).map(building => ({
      ...building,
      rooms: Object.values(building.rooms),
      room_count: Object.values(building.rooms).length,
      event_count: Object.values(building.rooms).reduce((sum, r) => sum + r.events.length, 0),
      conflict_count: Object.values(building.rooms).reduce((sum, r) => sum + r.conflicts.length, 0)
    })).filter(b => b.room_count > 0); // Only show buildings with rooms

    console.log('Buildings with events:', buildingsArray.map(b => `${b.building_name}: ${b.event_count} events, ${b.room_count} rooms`));

    const totalEvents = buildingsArray.reduce((sum, b) => sum + b.event_count, 0);
    const totalConflicts = buildingsArray.reduce((sum, b) => sum + b.conflict_count, 0);

    const result = {
      success: true,
      summary: {
        total_events: totalEvents,
        total_conflicts: totalConflicts,
        active_rooms: Object.keys(roomMap).length,
        date_range: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      },
      buildings: buildingsArray,
      cached: false
    };

    // Cache the result
    cachedResult = result;
    cacheTime = Date.now();

    return Response.json(result);

  } catch (error) {
    console.error('Error in getSetupCalendarEvents:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 200 });
  }
});