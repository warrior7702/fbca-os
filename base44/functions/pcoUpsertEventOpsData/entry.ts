import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const A = (x) => Array.isArray(x) ? x : [];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { events } = await req.json();
    
    if (!events || !Array.isArray(events)) {
      return Response.json({ 
        error: 'Invalid input: events array required' 
      }, { status: 400 });
    }

    const results = {
      events_upserted: 0,
      rooms_upserted: 0,
      approvals_upserted: 0,
      errors: []
    };

    for (const event of events) {
      try {
        // STEP 1: Upsert PCO_Event
        const existingEvents = await base44.asServiceRole.entities.PCO_Event.filter({
          pco_event_id: event.pco_event_id
        });

        const eventData = {
          pco_event_id: event.pco_event_id,
          title: event.title,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          status: event.status || 'active',
          updated_at: new Date().toISOString(),
          raw: event.raw || null
        };

        if (A(existingEvents).length > 0) {
          await base44.asServiceRole.entities.PCO_Event.update(
            existingEvents[0].id,
            eventData
          );
        } else {
          await base44.asServiceRole.entities.PCO_Event.create(eventData);
        }
        results.events_upserted++;

        // STEP 2: Replace/Upsert PCO_EventRoom entries
        // Delete existing rooms for this event first
        const existingRooms = await base44.asServiceRole.entities.PCO_EventRoom.filter({
          pco_event_id: event.pco_event_id
        });

        for (const existingRoom of A(existingRooms)) {
          await base44.asServiceRole.entities.PCO_EventRoom.delete(existingRoom.id);
        }

        // Create new room entries
        for (const room of A(event.rooms)) {
          // Try to find campus_hub_room_id if available
          let campusHubRoomId = null;
          try {
            const pcoRooms = await base44.asServiceRole.entities.PCO_BookableRoom.filter({
              pco_room_id: room.pco_room_id
            });
            if (A(pcoRooms).length > 0) {
              campusHubRoomId = pcoRooms[0].campus_hub_room_id || null;
            }
          } catch (err) {
            // Ignore if PCO_BookableRoom doesn't exist or has no mapping
          }

          await base44.asServiceRole.entities.PCO_EventRoom.create({
            pco_event_id: event.pco_event_id,
            pco_room_id: room.pco_room_id,
            room_name: room.room_name,
            campus_hub_room_id: campusHubRoomId,
            is_bookable: room.is_bookable !== false
          });
          results.rooms_upserted++;
        }

        // STEP 3: Upsert PCO_EventApprovalRequest (only Room Setups & Maintenance)
        for (const approval of A(event.approvals)) {
          // Filter to only target approval groups
          if (!['Room Setups', 'Maintenance'].includes(approval.approval_group)) {
            continue;
          }

          const existingApprovals = await base44.asServiceRole.entities.PCO_EventApprovalRequest.filter({
            pco_event_id: event.pco_event_id,
            approval_group: approval.approval_group
          });

          const approvalData = {
            pco_event_id: event.pco_event_id,
            approval_group: approval.approval_group,
            requested_resources: approval.requested_resources || {},
            answers: approval.answers || {},
            submitted_by: approval.submitted_by || null,
            submitted_at: approval.submitted_at,
            approval_status: approval.approval_status || 'pending',
            approved_at: approval.approved_at || null
          };

          if (A(existingApprovals).length > 0) {
            await base44.asServiceRole.entities.PCO_EventApprovalRequest.update(
              existingApprovals[0].id,
              approvalData
            );
          } else {
            await base44.asServiceRole.entities.PCO_EventApprovalRequest.create(approvalData);
          }
          results.approvals_upserted++;
        }

      } catch (eventError) {
        results.errors.push({
          event_id: event.pco_event_id,
          error: eventError.message
        });
        console.error(`Error upserting event ${event.pco_event_id}:`, eventError);
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in pcoUpsertEventOpsData:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});