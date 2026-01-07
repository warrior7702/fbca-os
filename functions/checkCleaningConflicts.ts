import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Checks for conflicts between scheduled events and cleaning windows.
 * Creates notifications and sends emails to Facilities Lead when conflicts detected.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get lead email from request body or default
    const { lead_email } = await req.json().catch(() => ({}));
    const facilitiesLeadEmail = lead_email || 'andy.milliorn@fbca.org';

    const now = new Date();
    const results = {
      conflicts_found: 0,
      notifications_created: 0,
      emails_sent: 0,
      conflicts: []
    };

    // Fetch upcoming events (next 7 days)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const allEvents = await base44.asServiceRole.entities.PCO_Event.list();
    const upcomingEvents = allEvents.filter(event => {
      const eventStart = new Date(event.starts_at);
      return eventStart >= now && eventStart <= sevenDaysLater;
    });

    // Fetch all cleaning schedules
    const cleaningSchedules = await base44.asServiceRole.entities.CleaningSchedule.list();

    // Fetch all PCO bookable rooms for mapping
    const pcoRooms = await base44.asServiceRole.entities.PCO_BookableRoom.list();

    // Check each event for conflicts
    for (const event of upcomingEvents) {
      if (!event.rooms || event.rooms.length === 0) continue;

      for (const pcoRoomId of event.rooms) {
        // Find the PCO room
        const pcoRoom = pcoRooms.find(r => r.pco_room_id === pcoRoomId);
        if (!pcoRoom) continue;

        // Find cleaning schedule for this room (by either PCO ID or Campus Hub ID)
        const schedule = cleaningSchedules.find(s => 
          s.pco_room_id === pcoRoomId || 
          (pcoRoom.campus_hub_room_id && s.campus_hub_room_id === pcoRoom.campus_hub_room_id)
        );

        if (!schedule) continue;

        const nextCleaningTime = new Date(schedule.next_cleaning_at);
        const eventStartTime = new Date(event.starts_at);

        // CONFLICT: Event starts BEFORE next scheduled cleaning
        if (eventStartTime < nextCleaningTime) {
          const conflict = {
            event_id: event.pco_event_id,
            event_title: event.title,
            event_starts_at: event.starts_at,
            room_name: pcoRoom.name,
            pco_room_id: pcoRoomId,
            next_cleaning_at: schedule.next_cleaning_at,
            hours_before_cleaning: Math.round((nextCleaningTime - eventStartTime) / (1000 * 60 * 60) * 10) / 10
          };

          results.conflicts.push(conflict);
          results.conflicts_found++;

          // Check if notification already exists for this conflict
          const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
            type: 'cleaning_conflict',
            related_event_id: event.pco_event_id,
            related_room_id: pcoRoomId
          });

          if (existingNotifications.length === 0) {
            // Create notification
            try {
              await base44.asServiceRole.entities.Notification.create({
                user_email: facilitiesLeadEmail,
                type: 'cleaning_conflict',
                title: `⚠️ Cleaning Conflict: ${pcoRoom.name}`,
                message: `Event "${event.title}" scheduled ${conflict.hours_before_cleaning}hrs before next cleaning in ${pcoRoom.name}`,
                related_event_id: event.pco_event_id,
                related_room_id: pcoRoomId,
                action_url: createPageUrl('MyDepartment') + '?tab=eventops',
                read: false
              });

              results.notifications_created++;

              // Send email notification
              try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: facilitiesLeadEmail,
                  subject: `Cleaning Conflict Alert: ${pcoRoom.name}`,
                  body: `
                    <h2>Cleaning Conflict Detected</h2>
                    <p><strong>Room:</strong> ${pcoRoom.name}</p>
                    <p><strong>Event:</strong> ${event.title}</p>
                    <p><strong>Event Start:</strong> ${new Date(event.starts_at).toLocaleString()}</p>
                    <p><strong>Next Scheduled Cleaning:</strong> ${nextCleaningTime.toLocaleString()}</p>
                    <p><strong>Issue:</strong> Event scheduled ${conflict.hours_before_cleaning} hours before next cleaning window</p>
                    
                    <p style="margin-top: 20px;">
                      <strong>Action Needed:</strong> Room may need cleaning before this event. 
                      Please review and adjust cleaning schedule or notify cleaning staff.
                    </p>
                  `
                });
                results.emails_sent++;
              } catch (emailError) {
                console.error('Failed to send conflict email:', emailError);
              }
            } catch (notificationError) {
              console.error('Failed to create notification:', notificationError);
            }
          }
        }
      }
    }

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking cleaning conflicts:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

function createPageUrl(pageName) {
  return `/app/${pageName}`;
}