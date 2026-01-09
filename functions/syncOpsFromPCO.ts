import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TARGET_APPROVAL_GROUPS = ['Room Setups', 'Maintenance'];
const HEAVY_USAGE_THRESHOLD_MINUTES = 360;

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
    const { dryRun = false } = body;
    
    const accessToken = await refreshPCOToken(base44, user);
    
    // Calculate date range (next 14 days)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 14);
    
    const startStr = now.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // Fetch event instances
    const eventsUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=starts_at&where[starts_at][gte]=${startStr}&where[starts_at][lte]=${endStr}&per_page=100&include=event,event_times,resource_bookings`;
    const eventsData = await fetchPCOData(accessToken, eventsUrl);
    
    const warnings = [];
    const eventOpsMap = new Map();
    const roomOpsArray = [];
    
    // Get all bookable rooms from PCO
    const roomsUrl = 'https://api.planningcenteronline.com/calendar/v2/resources?where[resource_type]=Room&per_page=100';
    const roomsData = await fetchPCOData(accessToken, roomsUrl);
    const bookableRoomIds = new Set();
    
    for (const room of roomsData.data || []) {
      const isBookable = room.attributes?.bookable !== false;
      bookableRoomIds.add(room.id);
      
      // Update Campus Hub Room entity
      if (!dryRun) {
        const existingRooms = await base44.entities.Room.filter({ pco_resource_id: room.id });
        if (existingRooms.length > 0) {
          await base44.entities.Room.update(existingRooms[0].id, {
            is_bookable: isBookable,
            bookable_source: 'PCO',
            last_pco_sync_at: new Date().toISOString()
          });
        }
      }
    }
    
    // Process events
    for (const instance of eventsData.data || []) {
      const eventId = instance.relationships?.event?.data?.id;
      if (!eventId) continue;
      
      const event = eventsData.included?.find(i => i.type === 'Event' && i.id === eventId);
      if (!event) continue;
      
      const startsAt = new Date(instance.attributes.starts_at);
      const endsAt = new Date(instance.attributes.ends_at);
      
      // Get resource bookings for this instance
      const bookings = eventsData.included?.filter(i => 
        i.type === 'ResourceBooking' && 
        i.relationships?.event_instance?.data?.id === instance.id
      ) || [];
      
      let needsRoomSetup = false;
      let needsMaintenance = false;
      const roomsForEvent = [];
      
      for (const booking of bookings) {
        const resourceId = booking.relationships?.resource?.data?.id;
        const approvalGroup = booking.attributes?.approval_group_name;
        
        if (!TARGET_APPROVAL_GROUPS.includes(approvalGroup)) continue;
        
        if (approvalGroup === 'Room Setups') needsRoomSetup = true;
        if (approvalGroup === 'Maintenance') needsMaintenance = true;
        
        // Only include bookable rooms
        if (bookableRoomIds.has(resourceId)) {
          const resource = eventsData.included?.find(i => 
            i.type === 'Resource' && i.id === resourceId
          );
          
          roomsForEvent.push({
            room_pco_resource_id: resourceId,
            room_name: resource?.attributes?.name || 'Unknown Room',
            booking_data: booking
          });
        }
      }
      
      if (roomsForEvent.length === 0) continue;
      
      // Calculate setup_due_at (starts_at - 60 minutes)
      const setupDueAt = new Date(startsAt);
      setupDueAt.setMinutes(setupDueAt.getMinutes() - 60);
      
      // Create EventOps entry
      const eventOpsData = {
        pco_event_id: eventId,
        event_name: event.attributes.name,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        approval_status: event.attributes?.approval_status || 'unknown',
        owner_name: event.attributes?.owner_name || null,
        owner_email: event.attributes?.owner_email || null,
        needs_room_setup: needsRoomSetup,
        needs_maintenance: needsMaintenance,
        setup_due_at: setupDueAt.toISOString(),
        rooms_count: roomsForEvent.length,
        last_synced_at: new Date().toISOString(),
        raw_pco: { event, instance, bookings }
      };
      
      eventOpsMap.set(eventId, eventOpsData);
      
      // Create RoomOps entries
      for (const room of roomsForEvent) {
        // Find previous event for this room (room_available_at)
        const previousEvents = eventsData.data.filter(ei => {
          const eiEnds = new Date(ei.attributes.ends_at);
          if (eiEnds >= startsAt) return false;
          
          const eiBookings = eventsData.included?.filter(i => 
            i.type === 'ResourceBooking' && 
            i.relationships?.event_instance?.data?.id === ei.id
          ) || [];
          
          return eiBookings.some(b => 
            b.relationships?.resource?.data?.id === room.room_pco_resource_id
          );
        });
        
        const mostRecentPrevious = previousEvents
          .sort((a, b) => new Date(b.attributes.ends_at) - new Date(a.attributes.ends_at))[0];
        
        const roomAvailableAt = mostRecentPrevious 
          ? new Date(mostRecentPrevious.attributes.ends_at).toISOString()
          : null;
        
        // Alert flags
        let alertHeavyUsage = false;
        let alertTurnaroundBeforeCleaning = false;
        let alertSaturdayNightPriority = false;
        
        // Check for next event (turnaround alert)
        const nextEvents = eventsData.data.filter(ei => {
          const eiStarts = new Date(ei.attributes.starts_at);
          if (eiStarts <= endsAt) return false;
          
          const eiBookings = eventsData.included?.filter(i => 
            i.type === 'ResourceBooking' && 
            i.relationships?.event_instance?.data?.id === ei.id
          ) || [];
          
          return eiBookings.some(b => 
            b.relationships?.resource?.data?.id === room.room_pco_resource_id
          );
        });
        
        if (nextEvents.length > 0) {
          const nextEvent = nextEvents.sort((a, b) => 
            new Date(a.attributes.starts_at) - new Date(b.attributes.starts_at)
          )[0];
          
          const minutesUntilNext = (new Date(nextEvent.attributes.starts_at) - endsAt) / 60000;
          if (minutesUntilNext < 120) {
            alertTurnaroundBeforeCleaning = true;
          }
        }
        
        // Heavy usage check (count minutes for this room on this day)
        const eventDate = startsAt.toISOString().split('T')[0];
        const dayEvents = eventsData.data.filter(ei => {
          const eiDate = new Date(ei.attributes.starts_at).toISOString().split('T')[0];
          if (eiDate !== eventDate) return false;
          
          const eiBookings = eventsData.included?.filter(i => 
            i.type === 'ResourceBooking' && 
            i.relationships?.event_instance?.data?.id === ei.id
          ) || [];
          
          return eiBookings.some(b => 
            b.relationships?.resource?.data?.id === room.room_pco_resource_id
          );
        });
        
        const totalMinutes = dayEvents.reduce((sum, ei) => {
          const duration = (new Date(ei.attributes.ends_at) - new Date(ei.attributes.starts_at)) / 60000;
          return sum + duration;
        }, 0);
        
        if (totalMinutes > HEAVY_USAGE_THRESHOLD_MINUTES) {
          alertHeavyUsage = true;
        }
        
        // Saturday night / Sunday morning priority
        const dayOfWeek = startsAt.getDay();
        const hour = startsAt.getHours();
        
        if ((dayOfWeek === 6 && hour >= 18) || dayOfWeek === 0) {
          alertSaturdayNightPriority = true;
        }
        
        roomOpsArray.push({
          pco_event_id: eventId,
          room_pco_resource_id: room.room_pco_resource_id,
          room_name: room.room_name,
          room_is_bookable: true,
          room_available_at: roomAvailableAt,
          setup_due_at: setupDueAt.toISOString(),
          clean_due_at: endsAt.toISOString(),
          alert_heavy_usage: alertHeavyUsage,
          alert_turnaround_before_cleaning: alertTurnaroundBeforeCleaning,
          alert_saturday_night_priority: alertSaturdayNightPriority,
          last_synced_at: new Date().toISOString(),
          raw_pco_room: { booking: room.booking_data, totalMinutes }
        });
      }
    }
    
    // Upsert to database (unless dry run)
    let eventOpsUpserted = 0;
    let roomOpsUpserted = 0;
    
    if (!dryRun) {
      for (const [eventId, eventData] of eventOpsMap) {
        // Check if exists
        const existing = await base44.entities.EventOps.filter({ pco_event_id: eventId });
        
        if (existing.length > 0) {
          // Update but preserve staff progress fields
          const updateData = { ...eventData };
          delete updateData.overall_status;
          delete updateData.percent_complete;
          
          await base44.entities.EventOps.update(existing[0].id, updateData);
        } else {
          await base44.entities.EventOps.create(eventData);
        }
        eventOpsUpserted++;
      }
      
      for (const roomOpsData of roomOpsArray) {
        // Check if exists (composite key: pco_event_id + room_pco_resource_id)
        const existing = await base44.entities.RoomOps.filter({
          pco_event_id: roomOpsData.pco_event_id,
          room_pco_resource_id: roomOpsData.room_pco_resource_id
        });
        
        if (existing.length > 0) {
          // Update but preserve staff progress fields
          const updateData = { ...roomOpsData };
          delete updateData.status_setup;
          delete updateData.status_cleaning;
          delete updateData.status_reset;
          delete updateData.assigned_to_email;
          delete updateData.notes;
          delete updateData.ready_at;
          
          await base44.entities.RoomOps.update(existing[0].id, updateData);
        } else {
          await base44.entities.RoomOps.create(roomOpsData);
        }
        roomOpsUpserted++;
      }
    }
    
    const durationMs = Date.now() - startTime;
    
    return Response.json({
      success: true,
      dryRun,
      counts: {
        events_scanned: eventsData.data?.length || 0,
        eventOps_upserted: eventOpsUpserted,
        roomOps_upserted: roomOpsUpserted
      },
      warnings,
      duration_ms: durationMs
    });
    
  } catch (error) {
    console.error('syncOpsFromPCO error:', error);
    return Response.json({
      success: false,
      error: error.message,
      duration_ms: Date.now() - startTime
    });
  }
});