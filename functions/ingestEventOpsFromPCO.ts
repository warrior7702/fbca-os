import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('🎯 EventOps ingest webhook called');
  
  try {
    // Security: Check optional secret header
    const ingestSecret = Deno.env.get('EVENTOPS_INGEST_SECRET');
    if (ingestSecret) {
      const providedSecret = req.headers.get('x-eventops-secret');
      if (providedSecret !== ingestSecret) {
        console.error('❌ Invalid secret header');
        return Response.json({
          ok: false,
          error: 'Unauthorized: Invalid or missing secret header'
        }, { status: 401 });
      }
      console.log('✅ Secret validated');
    } else {
      console.log('⚠️ No EVENTOPS_INGEST_SECRET set - allowing request');
    }

    // Parse payload
    const payload = await req.json();
    console.log('📦 Received payload:', {
      version: payload.version,
      generated_at: payload.generated_at,
      window_start: payload.window_start,
      window_end: payload.window_end,
      events_count: payload.events?.length || 0
    });

    // Validate payload structure
    if (!payload.version || !payload.generated_at || !payload.events) {
      return Response.json({
        ok: false,
        error: 'Invalid payload: missing required fields (version, generated_at, events)'
      }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    let totalRooms = 0;
    let totalResources = 0;

    // Process each event
    for (const event of payload.events) {
      console.log(`\n📅 Processing event: ${event.name} (${event.event_id})`);
      
      // Upsert event
      const existingEvents = await base44.asServiceRole.entities.EventOpsEvent.filter({
        event_id: event.event_id
      });

      const eventData = {
        event_id: event.event_id,
        event_name: event.name || event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        approval_status: event.approval_status || null,
        percent_approved: event.percent_approved || null,
        flags: event.flags || {},
        raw_payload: event,
        last_synced_at: now
      };

      if (existingEvents.length > 0) {
        await base44.asServiceRole.entities.EventOpsEvent.update(existingEvents[0].id, eventData);
        console.log(`  ✅ Updated event ${event.event_id}`);
      } else {
        await base44.asServiceRole.entities.EventOpsEvent.create(eventData);
        console.log(`  ✨ Created event ${event.event_id}`);
      }

      // Process resources for this event
      if (event.resources && Array.isArray(event.resources)) {
        for (const resource of event.resources) {
          const resourceData = {
            event_id: event.event_id,
            pco_resource_id: resource.id,
            approval_group_name: resource.approval_group_name || null,
            approval_status: resource.approval_status || null,
            quantity: resource.quantity || 1,
            answers: resource.answers || [],
            last_synced_at: now
          };

          // Determine if this is a room or other resource
          const isRoom = resource.kind === 'Room';

          if (isRoom) {
            // Process as room
            resourceData.room_name = resource.name;
            
            const existingRooms = await base44.asServiceRole.entities.EventOpsRoom.filter({
              event_id: event.event_id,
              pco_resource_id: resource.id
            });

            if (existingRooms.length > 0) {
              await base44.asServiceRole.entities.EventOpsRoom.update(existingRooms[0].id, resourceData);
            } else {
              await base44.asServiceRole.entities.EventOpsRoom.create(resourceData);
              totalRooms++;
            }
          } else {
            // Process as resource
            resourceData.resource_name = resource.name;
            resourceData.kind = resource.kind || 'Resource';
            resourceData.category = resource.category || null;

            const existingResources = await base44.asServiceRole.entities.EventOpsResource.filter({
              event_id: event.event_id,
              pco_resource_id: resource.id
            });

            if (existingResources.length > 0) {
              await base44.asServiceRole.entities.EventOpsResource.update(existingResources[0].id, resourceData);
            } else {
              await base44.asServiceRole.entities.EventOpsResource.create(resourceData);
              totalResources++;
            }
          }
        }
      }
    }

    // Update sync state
    const syncStateData = {
      version: payload.version,
      last_ingest_at: now,
      window_start: payload.window_start || null,
      window_end: payload.window_end || null,
      events_count: payload.events.length,
      rooms_count: totalRooms,
      resources_count: totalResources,
      generated_at: payload.generated_at
    };

    const existingSyncStates = await base44.asServiceRole.entities.EventOpsSyncState.list();
    
    if (existingSyncStates.length > 0) {
      // Update the most recent one
      await base44.asServiceRole.entities.EventOpsSyncState.update(
        existingSyncStates[0].id,
        syncStateData
      );
      console.log('✅ Updated sync state');
    } else {
      await base44.asServiceRole.entities.EventOpsSyncState.create(syncStateData);
      console.log('✨ Created sync state');
    }

    console.log(`\n🎉 Ingest complete: ${payload.events.length} events, ${totalRooms} rooms, ${totalResources} resources`);

    return Response.json({
      ok: true,
      ingested: {
        events: payload.events.length,
        rooms: totalRooms,
        resources: totalResources,
        timestamp: now
      }
    });

  } catch (error) {
    console.error('❌ Ingest error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});