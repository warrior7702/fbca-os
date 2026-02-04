import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { mappings } = await req.json();

    if (!mappings || !Array.isArray(mappings)) {
      return Response.json({ error: 'mappings array required' }, { status: 400 });
    }

    const updated = [];
    const notFound = [];
    const errors = [];

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const DELAY_MS = 1000; // 1 second delay between batches

    for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
      const batch = mappings.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (mapping) => {
        try {
          // Find room by akita_room_id
          const rooms = await base44.asServiceRole.entities.Room.filter({
            akita_room_id: mapping.Akita_Room_ID
          });

          if (rooms.length === 0) {
            notFound.push({
              akita_room_id: mapping.Akita_Room_ID,
              room_number: mapping.Room_Number,
              room_name: mapping.Room_Name
            });
            return;
          }

          const room = rooms[0];

          // Update room with zone assignment
          await base44.asServiceRole.entities.Room.update(room.id, {
            zone_id: mapping.Zone_ID,
            cleaning_schedule: mapping.Cleaning_Schedule
          });

          updated.push({
            room_id: room.id,
            room_number: mapping.Room_Number,
            zone_id: mapping.Zone_ID,
            schedule: mapping.Cleaning_Schedule
          });

        } catch (error) {
          errors.push({
            akita_room_id: mapping.Akita_Room_ID,
            error: error.message
          });
        }
      }));

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < mappings.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    return Response.json({
      success: true,
      updated_count: updated.length,
      not_found_count: notFound.length,
      error_count: errors.length,
      updated: updated,
      not_found: notFound,
      errors: errors
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});