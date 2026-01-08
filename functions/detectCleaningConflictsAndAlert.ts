import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Detecting cleaning conflicts...');

    // Get all EventOpsRoomState entries with clean_due_at
    const roomStates = await base44.asServiceRole.entities.EventOpsRoomState.list();
    const roomStatesWithCleaning = roomStates.filter(rs => 
      rs.clean_due_at && rs.clean_status !== 'alerted' && rs.clean_status !== 'done'
    );

    console.log(`📋 Found ${roomStatesWithCleaning.length} rooms with pending cleaning`);

    // Get all PCO events
    const allEvents = await base44.asServiceRole.entities.PCO_Event.list();
    const allEventRooms = await base44.asServiceRole.entities.PCO_EventRoom.list();

    const conflicts = [];

    for (const roomState of roomStatesWithCleaning) {
      // Get the current event
      const currentEvent = allEvents.find(e => e.pco_event_id === roomState.pco_event_id);
      if (!currentEvent) continue;

      const currentEventEnd = new Date(currentEvent.ends_at);
      const cleanDueAt = new Date(roomState.clean_due_at);

      // Find all events in the same room
      const sameRoomEvents = allEventRooms.filter(er => 
        er.pco_room_id === roomState.pco_room_id &&
        er.pco_event_id !== roomState.pco_event_id
      );

      // Check for conflicts
      for (const eventRoom of sameRoomEvents) {
        const otherEvent = allEvents.find(e => e.pco_event_id === eventRoom.pco_event_id);
        if (!otherEvent) continue;

        const otherEventStart = new Date(otherEvent.starts_at);

        // Conflict: another event starts after current event ends but before cleaning is due
        if (otherEventStart > currentEventEnd && otherEventStart < cleanDueAt) {
          conflicts.push({
            roomState: roomState,
            currentEvent: currentEvent,
            conflictingEvent: otherEvent,
            roomName: eventRoom.room_name,
            pcoRoomId: roomState.pco_room_id
          });
          break; // One conflict per room is enough
        }
      }
    }

    console.log(`⚠️ Found ${conflicts.length} cleaning conflicts`);

    // Process conflicts
    for (const conflict of conflicts) {
      // Update room state to 'alerted'
      await base44.asServiceRole.entities.EventOpsRoomState.update(conflict.roomState.id, {
        clean_status: 'alerted',
        clean_alert_sent_at: new Date().toISOString()
      });

      // Find maintenance lead - look for user with ticket_role='admin' or role='admin'
      let maintenanceLead = null;
      try {
        const rolesResponse = await base44.asServiceRole.functions.invoke('getUsersWithTicketRoles');
        if (rolesResponse.data?.success) {
          const leads = rolesResponse.data.allUsers.filter(u => 
            u.ticket_role === 'admin' || u.ticket_role === 'worker'
          );
          if (leads.length > 0) {
            maintenanceLead = leads[0]; // Pick first lead
          }
        }
      } catch (err) {
        console.warn('Could not fetch ticket roles, trying admins:', err);
        // Fallback: find any admin user
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        if (admins.length > 0) {
          maintenanceLead = { user_email: admins[0].email };
        }
      }

      if (!maintenanceLead) {
        console.warn('No maintenance lead found for notification');
        continue;
      }

      // Create notification
      const notificationData = {
        user_email: maintenanceLead.user_email,
        type: 'cleaning_conflict',
        title: `Cleaning Conflict: ${conflict.roomName}`,
        message: `Event "${conflict.currentEvent.title}" ends at ${new Date(conflict.currentEvent.ends_at).toLocaleString()}, but "${conflict.conflictingEvent.title}" starts at ${new Date(conflict.conflictingEvent.starts_at).toLocaleString()} before cleaning is due. Cleaning window at risk.`,
        related_entity_type: 'EventOpsRoomState',
        related_entity_id: conflict.roomState.id,
        action_url: `/EventOpsDetail?id=${conflict.currentEvent.pco_event_id}`,
        metadata: {
          pco_event_id: conflict.currentEvent.pco_event_id,
          pco_room_id: conflict.pcoRoomId,
          conflicting_event_id: conflict.conflictingEvent.pco_event_id,
          clean_due_at: conflict.roomState.clean_due_at
        }
      };

      // Check if notification already exists
      const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
        user_email: maintenanceLead.user_email,
        type: 'cleaning_conflict',
        related_entity_id: conflict.roomState.id
      });

      if (existingNotifications.length === 0) {
        await base44.asServiceRole.entities.Notification.create(notificationData);
        console.log(`✅ Created notification for ${maintenanceLead.user_email}`);

        // Optional: send email
        try {
          await base44.asServiceRole.functions.invoke('createNotification', {
            ...notificationData,
            send_email: true
          });
        } catch (emailErr) {
          console.warn('Email notification failed:', emailErr);
        }
      } else {
        console.log(`ℹ️ Notification already exists for ${conflict.roomName}`);
      }
    }

    return Response.json({
      success: true,
      conflicts_detected: conflicts.length,
      conflicts: conflicts.map(c => ({
        room_name: c.roomName,
        current_event: c.currentEvent.title,
        conflicting_event: c.conflictingEvent.title,
        clean_due_at: c.roomState.clean_due_at
      }))
    });

  } catch (error) {
    console.error('Error detecting cleaning conflicts:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});