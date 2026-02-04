import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get sample of rooms to check field names
    const allRooms = await base44.asServiceRole.entities.Room.list('-created_date', 10);
    
    // Get count by cleaning_schedule
    const roomsBySchedule = {};
    const allRoomsForCount = await base44.asServiceRole.entities.Room.list();
    
    for (const room of allRoomsForCount) {
      const schedule = room.cleaning_schedule || 'unassigned';
      roomsBySchedule[schedule] = (roomsBySchedule[schedule] || 0) + 1;
    }

    // Get zones
    const zones = await base44.asServiceRole.entities.CleaningZone.list();
    const zonesByCategory = {};
    
    for (const zone of zones) {
      const cat = zone.category || 'unknown';
      zonesByCategory[cat] = (zonesByCategory[cat] || 0) + 1;
    }

    // Count rooms with schedules
    const roomsWithSchedule = allRoomsForCount.filter(r => r.cleaning_schedule && r.cleaning_schedule !== 'unknown').length;
    const roomsWithoutSchedule = allRoomsForCount.length - roomsWithSchedule;

    return Response.json({
      success: true,
      total_rooms: allRoomsForCount.length,
      total_zones: zones.length,
      rooms_with_schedule: roomsWithSchedule,
      rooms_without_schedule: roomsWithoutSchedule,
      sample_rooms: allRooms.map(r => ({
        id: r.id,
        akita_room_id: r.akita_room_id,
        room_number: r.room_number,
        room_name: r.room_name,
        zone_id: r.zone_id,
        cleaning_schedule: r.cleaning_schedule
      })),
      rooms_by_schedule: roomsBySchedule,
      zones_by_category: zonesByCategory
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});