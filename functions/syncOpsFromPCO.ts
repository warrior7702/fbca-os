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

async function fetchResourceRequestAnswers(accessToken, requestId) {
  try {
    const url = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${requestId}/answers?per_page=100`;
    const data = await fetchPCOData(accessToken, url);
    
    if (!data.data || data.data.length === 0) return [];
    
    return data.data.map(answer => ({
      question: answer.attributes?.question || '',
      answer: answer.attributes?.answer || '',
      question_id: answer.relationships?.resource_question?.data?.id || null,
      kind: answer.attributes?.kind || null
    }));
  } catch (error) {
    console.warn(`Failed to fetch answers for request ${requestId}:`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const logs = [];
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Try to authenticate - if fails, use service role for scheduled task
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      logs.push('No authenticated user - running as service role');
      user = null;
    }

    const body = await req.json().catch(() => ({}));
    const { days = 14, dryRun = false } = body;
    
    // Get a user with PCO token for service role execution
    let accessToken;
    if (!user || !user.pco_access_token) {
      logs.push('Fetching PCO user for service role...');
      const users = await base44.asServiceRole.entities.User.list();
      const pcoUser = users.find(u => u.pco_access_token);
      
      if (!pcoUser) {
        return Response.json({
          success: false,
          error: 'No user with PCO connection found',
          logs
        });
      }
      
      accessToken = await refreshPCOToken(base44.asServiceRole, pcoUser);
      logs.push(`Using PCO token from ${pcoUser.email}`);
    } else {
      accessToken = await refreshPCOToken(base44, user);
      logs.push(`Using PCO token from authenticated user`);
    }
    
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    
    const startStr = now.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // Fetch approval groups
    const groupsUrl = 'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100';
    const groupsData = await fetchPCOData(accessToken, groupsUrl);
    
    const roomSetupsGroup = groupsData.data.find(g => g.attributes.name === 'Room Setups');
    const maintenanceGroup = groupsData.data.find(g => g.attributes.name === 'Maintenance');
    
    if (!roomSetupsGroup && !maintenanceGroup) {
      logs.push('No Room Setups or Maintenance groups found');
      return Response.json({
        success: false,
        error: 'Required approval groups not found',
        logs
      });
    }
    
    const targetGroupIds = [roomSetupsGroup?.id, maintenanceGroup?.id].filter(Boolean);
    logs.push(`Target groups: ${targetGroupIds.join(', ')}`);
    
    // Fetch event instances with resource requests for answers
    const eventsUrl = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=starts_at&where[starts_at][gte]=${startStr}&where[starts_at][lte]=${endStr}&per_page=100&include=event,resource_bookings,event.resource_requests`;
    const eventsData = await fetchPCOData(accessToken, eventsUrl);
    
    logs.push(`Fetched ${eventsData.data?.length || 0} events`);
    
    // Fetch bookable rooms
    const roomsUrl = 'https://api.planningcenteronline.com/calendar/v2/resources?where[resource_type]=Room&per_page=100';
    const roomsData = await fetchPCOData(accessToken, roomsUrl);
    
    const bookableRoomsMap = new Map();
    for (const room of roomsData.data || []) {
      const isBookable = room.attributes?.bookable !== false;
      bookableRoomsMap.set(room.id, {
        id: room.id,
        name: room.attributes.name,
        is_bookable: isBookable
      });
      
      // Upsert to Room entity if bookable
      if (!dryRun) {
        try {
          const existingRooms = await base44.asServiceRole.entities.Room.filter({ pco_resource_id: room.id });
          if (existingRooms.length > 0) {
            await base44.asServiceRole.entities.Room.update(existingRooms[0].id, {
              is_bookable: isBookable,
              last_pco_sync_at: new Date().toISOString()
            });
          }
        } catch (err) {
          logs.push(`Warning: Could not update Room for PCO ID ${room.id}`);
        }
      }
    }
    
    logs.push(`Found ${bookableRoomsMap.size} rooms in PCO`);
    
    const warnings = [];
    let eventsScanned = 0;
    let eventOpsUpserted = 0;
    let roomOpsUpserted = 0;
    
    // Process each event
    for (const instance of eventsData.data || []) {
      try {
        eventsScanned++;
        
        const eventId = instance.relationships?.event?.data?.id;
        const instanceId = instance.id;
        const startsAt = instance.attributes.starts_at;
        const endsAt = instance.attributes.ends_at;
        
        // Get event details
        const eventDetails = eventsData.included?.find(i => 
          i.type === 'Event' && i.id === eventId
        );
        
        // Get resource bookings
        const bookings = eventsData.included?.filter(i => 
          i.type === 'ResourceBooking' && 
          i.relationships?.event_instance?.data?.id === instanceId
        ) || [];
        
        // Get resource requests for approval answers
        const resourceRequests = eventsData.included?.filter(i => 
          i.type === 'ResourceRequest' && 
          i.relationships?.event?.data?.id === eventId
        ) || [];
        
        // Check if any bookings are for Room Setups or Maintenance
        let needsRoomSetup = false;
        let needsMaintenance = false;
        const eventRooms = [];
        
        for (const booking of bookings) {
          const resourceId = booking.relationships?.resource?.data?.id;
          const approvalGroupId = booking.relationships?.resource_approval_group?.data?.id;
          
          if (approvalGroupId === roomSetupsGroup?.id) needsRoomSetup = true;
          if (approvalGroupId === maintenanceGroup?.id) needsMaintenance = true;
          
          // Collect bookable rooms
          const roomInfo = bookableRoomsMap.get(resourceId);
          if (roomInfo?.is_bookable) {
            eventRooms.push(roomInfo);
          }
        }
        
        // Skip if no relevant approval groups
        if (!needsRoomSetup && !needsMaintenance) continue;
        
        // Calculate setup_due_at (60 minutes before start)
        const setupDueAt = new Date(new Date(startsAt).getTime() - 60 * 60 * 1000);
        
        // Extract approval answers with detailed answers per request
        const roomSetupsAnswers = {};
        const maintenanceAnswers = {};
        const detailedAnswers = { room_setups: [], maintenance: [] };
        
        for (const request of resourceRequests) {
          const approvalGroupId = request.relationships?.resource_approval_group?.data?.id;
          const requestData = request.attributes || {};
          const requestId = request.id;
          
          // Fetch detailed answers from /event_resource_requests/{id}/answers
          const answers = await fetchResourceRequestAnswers(accessToken, requestId);
          
          if (approvalGroupId === roomSetupsGroup?.id) {
            Object.assign(roomSetupsAnswers, requestData.approval_answers || {});
            if (answers.length > 0) {
              detailedAnswers.room_setups.push({
                resource_name: requestData.resource_name || 'Unknown',
                answers: answers
              });
            }
          } else if (approvalGroupId === maintenanceGroup?.id) {
            Object.assign(maintenanceAnswers, requestData.approval_answers || {});
            if (answers.length > 0) {
              detailedAnswers.maintenance.push({
                resource_name: requestData.resource_name || 'Unknown',
                answers: answers
              });
            }
          }
        }
        
        // Calculate alerts
        const eventDate = new Date(startsAt);
        const isSaturday = eventDate.getDay() === 6;
        const isSaturdayEvening = isSaturday && eventDate.getHours() >= 18;
        const alertSaturdayNightPriority = isSaturdayEvening || (eventDate.getDay() === 0);
        
        // Check if existing EventOps record
        const existingEventOps = await base44.asServiceRole.entities.EventOps.filter({ 
          pco_event_id: instanceId 
        });
        
        const eventOpsData = {
          pco_event_id: instanceId,
          event_name: eventDetails?.attributes?.name || 'Unknown Event',
          starts_at: startsAt,
          ends_at: endsAt,
          approval_status: instance.attributes?.approval_status || 'unknown',
          owner_name: eventDetails?.attributes?.owner_name || null,
          owner_email: null,
          needs_room_setup: needsRoomSetup,
          needs_maintenance: needsMaintenance,
          setup_due_at: setupDueAt.toISOString(),
          rooms_count: eventRooms.length,
          alert_saturday_night_priority: alertSaturdayNightPriority,
          last_synced_at: new Date().toISOString(),
          raw_pco: {
            instance,
            event: eventDetails,
            approval_answers: {
              room_setups: roomSetupsAnswers,
              maintenance: maintenanceAnswers
            },
            detailed_answers: detailedAnswers
          }
        };
        
        // Only update PCO-derived fields if record exists
        if (existingEventOps.length > 0) {
          const existing = existingEventOps[0];
          const updateData = { ...eventOpsData };
          
          // Preserve staff progress fields
          delete updateData.overall_status;
          delete updateData.percent_complete;
          
          if (!dryRun) {
            await base44.asServiceRole.entities.EventOps.update(existing.id, updateData);
          }
          eventOpsUpserted++;
        } else {
          // Create new
          eventOpsData.overall_status = 'Not Started';
          eventOpsData.percent_complete = 0;
          eventOpsData.rooms_complete_count = 0;
          
          if (!dryRun) {
            await base44.asServiceRole.entities.EventOps.create(eventOpsData);
          }
          eventOpsUpserted++;
        }
        
        // Process RoomOps for each bookable room
        for (const roomInfo of eventRooms) {
          try {
            // Find room_available_at (most recent previous event in same room)
            let roomAvailableAt = null;
            
            const allEventsForRoom = eventsData.data
              .filter(evt => {
                const evtBookings = eventsData.included?.filter(i => 
                  i.type === 'ResourceBooking' && 
                  i.relationships?.event_instance?.data?.id === evt.id &&
                  i.relationships?.resource?.data?.id === roomInfo.id
                ) || [];
                return evtBookings.length > 0;
              })
              .map(evt => ({
                starts_at: evt.attributes.starts_at,
                ends_at: evt.attributes.ends_at
              }))
              .sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at));
            
            for (const otherEvent of allEventsForRoom) {
              const otherEnd = new Date(otherEvent.ends_at);
              const currentStart = new Date(startsAt);
              
              if (otherEnd < currentStart) {
                roomAvailableAt = otherEvent.ends_at;
              }
            }
            
            // Calculate clean_due_at (2 hours after event ends - configurable)
            const cleanDueAt = new Date(new Date(endsAt).getTime() + 2 * 60 * 60 * 1000);
            
            // Check heavy usage alert (using RoomOccupancyDaily data)
            const dateKey = startsAt.split('T')[0];
            const occupancyRecords = await base44.asServiceRole.entities.RoomOccupancyDaily.filter({
              date: dateKey,
              room_pco_resource_id: roomInfo.id
            });
            const alertHeavyUsage = occupancyRecords.length > 0 && occupancyRecords[0].minutes_booked > 360;
            
            // Check turnaround alert (placeholder: check if next event exists within 2 hours)
            let alertTurnaround = false;
            for (const otherEvent of allEventsForRoom) {
              const otherStart = new Date(otherEvent.starts_at);
              const currentEnd = new Date(endsAt);
              const gap = (otherStart - currentEnd) / (1000 * 60); // minutes
              
              if (gap > 0 && gap < 120) {
                alertTurnaround = true;
                break;
              }
            }
            
            const roomOpsData = {
              pco_event_id: instanceId,
              room_pco_resource_id: roomInfo.id,
              room_name: roomInfo.name,
              room_is_bookable: roomInfo.is_bookable,
              room_available_at: roomAvailableAt,
              setup_due_at: setupDueAt.toISOString(),
              clean_due_at: cleanDueAt.toISOString(),
              alert_heavy_usage: alertHeavyUsage,
              alert_turnaround_before_cleaning: alertTurnaround,
              alert_saturday_night_priority: alertSaturdayNightPriority,
              last_synced_at: new Date().toISOString(),
              raw_pco_room: {
                pco_resource_id: roomInfo.id,
                name: roomInfo.name
              }
            };
            
            // Check if existing RoomOps record
            const existingRoomOps = await base44.asServiceRole.entities.RoomOps.filter({
              pco_event_id: instanceId,
              room_pco_resource_id: roomInfo.id
            });
            
            if (existingRoomOps.length > 0) {
              const existing = existingRoomOps[0];
              const updateData = { ...roomOpsData };
              
              // Preserve staff progress fields
              if (existing.status_setup) delete updateData.status_setup;
              if (existing.status_cleaning) delete updateData.status_cleaning;
              if (existing.status_reset) delete updateData.status_reset;
              if (existing.assigned_to_email) delete updateData.assigned_to_email;
              if (existing.notes) delete updateData.notes;
              if (existing.ready_at) delete updateData.ready_at;
              
              if (!dryRun) {
                await base44.asServiceRole.entities.RoomOps.update(existing.id, updateData);
              }
              roomOpsUpserted++;
            } else {
              // Create new
              roomOpsData.status_setup = 'Not Started';
              roomOpsData.status_cleaning = 'Not Started';
              roomOpsData.status_reset = 'Not Started';
              
              if (!dryRun) {
                await base44.asServiceRole.entities.RoomOps.create(roomOpsData);
              }
              roomOpsUpserted++;
            }
          } catch (roomError) {
            warnings.push(`Error processing room ${roomInfo.id}: ${roomError.message}`);
          }
        }
        
        // Update EventOps completion metrics
        if (!dryRun && eventRooms.length > 0) {
          const allRoomOps = await base44.asServiceRole.entities.RoomOps.filter({ 
            pco_event_id: instanceId 
          });
          
          const completeCount = allRoomOps.filter(r => {
            const setupDone = r.status_setup === 'Done';
            const cleaningDone = r.status_cleaning === 'Done' || !r.clean_due_at;
            return setupDone && cleaningDone;
          }).length;
          
          const percentComplete = allRoomOps.length > 0 
            ? Math.round((completeCount / allRoomOps.length) * 100)
            : 0;
          
          const overallStatus = percentComplete === 100 ? 'Done' :
                               percentComplete > 0 ? 'In Progress' : 'Not Started';
          
          const existingEventOps = await base44.asServiceRole.entities.EventOps.filter({ 
            pco_event_id: instanceId 
          });
          
          if (existingEventOps.length > 0) {
            await base44.asServiceRole.entities.EventOps.update(existingEventOps[0].id, {
              rooms_complete_count: completeCount,
              percent_complete: percentComplete,
              overall_status: overallStatus
            });
          }
        }
        
      } catch (eventError) {
        warnings.push(`Error processing event ${instance.id}: ${eventError.message}`);
      }
    }
    
    const durationMs = Date.now() - startTime;
    
    logs.push(`Completed: ${eventsScanned} events scanned, ${eventOpsUpserted} EventOps, ${roomOpsUpserted} RoomOps`);
    
    return Response.json({
      success: true,
      counts: {
        events_scanned: eventsScanned,
        eventOps_upserted: eventOpsUpserted,
        roomOps_upserted: roomOpsUpserted
      },
      warnings,
      duration_ms: durationMs,
      logs,
      dry_run: dryRun
    });
    
  } catch (error) {
    console.error('syncOpsFromPCO error:', error);
    logs.push(`ERROR: ${error.message}`);
    
    return Response.json({
      success: false,
      error: error.message,
      logs,
      duration_ms: Date.now() - startTime
    });
  }
});