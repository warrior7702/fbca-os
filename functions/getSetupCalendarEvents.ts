import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Refresh PCO token if needed
async function refreshPCOTokenIfNeeded(base44, user) {
  if (!user.pco_access_token) return null;
  
  const expiresAt = new Date(user.pco_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  
  if (expiresAt <= fiveMinutesFromNow && user.pco_refresh_token) {
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
      const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
      await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
      });
      return tokens.access_token;
    }
  }
  
  return user.pco_access_token;
}

// Fetch PCO events for date range
async function getPCOEvents(pcoToken, startDate, endDate) {
  const headers = { 'Authorization': `Bearer ${pcoToken}` };
  const events = [];
  
  // Fetch event instances in date range
  const instancesUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&order=starts_at&per_page=100`;
  const instancesResponse = await fetch(instancesUrl, { headers });
  
  if (!instancesResponse.ok) {
    throw new Error(`PCO API error: ${instancesResponse.status}`);
  }
  
  const instancesData = await instancesResponse.json();
  const instances = instancesData.data || [];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Filter instances to date range
  const filteredInstances = instances.filter(instance => {
    const startsAt = new Date(instance.attributes?.starts_at);
    return startsAt >= start && startsAt <= end;
  });
  
  console.log(`[DEBUG] Found ${filteredInstances.length} instances in date range`);
  
  // Fetch event details with resources
  for (const instance of filteredInstances) {
    const eventId = instance.relationships?.event?.data?.id;
    if (!eventId) continue;
    
    try {
      // Fetch event resource requests
      const requestsUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource,event&per_page=100`;
      const requestsResponse = await fetch(requestsUrl, { headers });
      
      if (!requestsResponse.ok) continue;
      
      const requestsData = await requestsResponse.json();
      const requests = requestsData.data || [];
      const included = requestsData.included || [];
      
      // Get event details
      const eventDetail = included.find(i => i.type === 'Event' && i.id === eventId);
      
      // Map resources
      const rooms = [];
      for (const request of requests) {
        const resourceId = request.relationships?.resource?.data?.id;
        const resource = included.find(i => i.type === 'Resource' && i.id === resourceId);
        
        if (resource) {
          rooms.push({
            pco_resource_id: resourceId,
            resource_name: resource.attributes?.name || 'Unknown',
            quantity: request.attributes?.quantity || 1
          });
        }
      }
      
      if (rooms.length > 0) {
        events.push({
          pco_event_id: eventId,
          event_name: instance.attributes?.name || eventDetail?.attributes?.name || 'Unknown Event',
          start_time: instance.attributes?.starts_at,
          end_time: instance.attributes?.ends_at,
          rooms: rooms
        });
      }
      
    } catch (e) {
      console.error(`[DEBUG] Failed to fetch event ${eventId}:`, e.message);
    }
  }
  
  console.log(`[DEBUG] Processed ${events.length} events with rooms`);
  return events;
}

// Parse setup requirements from event
function parseSetupRequirements(event) {
  // Default setup/teardown times (in minutes)
  const DEFAULT_SETUP = 60;
  const DEFAULT_TEARDOWN = 60;
  
  return {
    event_id: event.pco_event_id,
    event_name: event.event_name,
    start_time: event.start_time,
    end_time: event.end_time,
    rooms: event.rooms.map(room => ({
      pco_resource_id: room.pco_resource_id,
      resource_name: room.resource_name,
      setup_type: 'Standard', // TODO: Parse from PCO questions/answers
      setup_time_minutes: DEFAULT_SETUP,
      teardown_time_minutes: DEFAULT_TEARDOWN
    }))
  };
}

// Detect setup/teardown conflicts
function detectSetupConflicts(events) {
  const conflicts = [];
  
  // Group events by room
  const eventsByRoom = {};
  for (const event of events) {
    for (const room of event.rooms) {
      const key = room.pco_resource_id;
      if (!eventsByRoom[key]) {
        eventsByRoom[key] = [];
      }
      eventsByRoom[key].push({
        ...event,
        room: room
      });
    }
  }
  
  // Check each room for conflicts
  for (const [roomId, roomEvents] of Object.entries(eventsByRoom)) {
    // Sort by start time
    const sorted = roomEvents.sort((a, b) => 
      new Date(a.start_time) - new Date(b.start_time)
    );
    
    // Check consecutive events
    for (let i = 0; i < sorted.length - 1; i++) {
      const event1 = sorted[i];
      const event2 = sorted[i + 1];
      
      const end1 = new Date(event1.end_time);
      const start2 = new Date(event2.start_time);
      
      const gapMinutes = (start2 - end1) / (1000 * 60);
      const requiredMinutes = event1.room.teardown_time_minutes + event2.room.setup_time_minutes;
      
      if (gapMinutes < requiredMinutes) {
        const shortageMinutes = requiredMinutes - gapMinutes;
        
        conflicts.push({
          pco_resource_id: roomId,
          resource_name: event1.room.resource_name,
          event1: {
            event_id: event1.event_id,
            event_name: event1.event_name,
            start_time: event1.start_time,
            end_time: event1.end_time,
            teardown_minutes: event1.room.teardown_time_minutes
          },
          event2: {
            event_id: event2.event_id,
            event_name: event2.event_name,
            start_time: event2.start_time,
            end_time: event2.end_time,
            setup_minutes: event2.room.setup_time_minutes
          },
          gap_minutes: Math.round(gapMinutes),
          required_minutes: requiredMinutes,
          shortage_minutes: Math.round(shortageMinutes)
        });
      }
    }
  }
  
  return conflicts;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query params
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = url.searchParams.get('end_date') || 
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const buildingFilter = url.searchParams.get('building_id');
    
    console.log(`[DEBUG] Fetching events from ${startDate} to ${endDate}`);
    
    // Get user with PCO tokens
    const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userWithTokens = users[0];
    
    if (!userWithTokens?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 400 });
    }
    
    // Refresh token if needed
    const pcoToken = await refreshPCOTokenIfNeeded(base44, userWithTokens);
    
    // Fetch PCO events
    const pcoEvents = await getPCOEvents(pcoToken, startDate, endDate);
    
    // Parse setup requirements
    const eventsWithSetup = pcoEvents.map(event => parseSetupRequirements(event));
    
    // Detect conflicts
    const allConflicts = detectSetupConflicts(eventsWithSetup);
    
    console.log(`[DEBUG] Detected ${allConflicts.length} conflicts`);
    
    // Get rooms from database to map PCO resources to campus hub rooms
    const allRooms = await base44.asServiceRole.entities.Room.list();
    const roomMap = {};
    allRooms.forEach(room => {
      if (room.pco_resource_id) {
        roomMap[room.pco_resource_id] = room;
      }
    });
    
    // Group by building
    const buildingMap = {};
    
    for (const event of eventsWithSetup) {
      for (const room of event.rooms) {
        const campusRoom = roomMap[room.pco_resource_id];
        if (!campusRoom) continue;
        
        const buildingId = campusRoom.building_id || 'unknown';
        const buildingName = campusRoom.building_name || campusRoom.building || 'Unknown Building';
        
        // Filter by building if specified
        if (buildingFilter && buildingId !== buildingFilter) continue;
        
        if (!buildingMap[buildingId]) {
          buildingMap[buildingId] = {
            building_id: buildingId,
            building_name: buildingName,
            room_count: 0,
            event_count: 0,
            conflict_count: 0,
            rooms: {}
          };
        }
        
        const roomId = campusRoom.id;
        if (!buildingMap[buildingId].rooms[roomId]) {
          buildingMap[buildingId].rooms[roomId] = {
            room_id: roomId,
            room_name: campusRoom.room_name,
            room_number: campusRoom.room_number,
            pco_resource_id: room.pco_resource_id,
            events: [],
            conflicts: []
          };
          buildingMap[buildingId].room_count++;
        }
        
        buildingMap[buildingId].rooms[roomId].events.push({
          ...event,
          room_setup: room
        });
        buildingMap[buildingId].event_count++;
      }
    }
    
    // Add conflicts to rooms
    for (const conflict of allConflicts) {
      for (const building of Object.values(buildingMap)) {
        for (const room of Object.values(building.rooms)) {
          if (room.pco_resource_id === conflict.pco_resource_id) {
            room.conflicts.push(conflict);
            building.conflict_count++;
          }
        }
      }
    }
    
    // Convert to array
    const buildings = Object.values(buildingMap).map(building => ({
      ...building,
      rooms: Object.values(building.rooms)
    }));
    
    // Calculate summary
    const summary = {
      total_events: eventsWithSetup.length,
      total_conflicts: allConflicts.length,
      active_rooms: Object.values(buildingMap).reduce((sum, b) => sum + b.room_count, 0),
      date_range: {
        start: startDate,
        end: endDate
      }
    };
    
    return Response.json({
      success: true,
      summary,
      buildings
    });
    
  } catch (error) {
    console.error('getSetupCalendarEvents error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});