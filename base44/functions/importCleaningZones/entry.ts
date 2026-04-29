import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { zones } = await req.json();

    if (!zones || !Array.isArray(zones)) {
      return Response.json({ error: 'zones array required' }, { status: 400 });
    }

    // Delete existing zones
    const existingZones = await base44.asServiceRole.entities.CleaningZone.list();
    for (const zone of existingZones) {
      await base44.asServiceRole.entities.CleaningZone.delete(zone.id);
    }

    // Import new zones
    const imported = [];
    for (const zone of zones) {
      const created = await base44.asServiceRole.entities.CleaningZone.create({
        zone_id: zone.Zone_ID,
        building: zone.Building,
        floor: zone.Floor,
        category: zone.Category,
        schedule_note: zone.Schedule_Note,
        room_count: parseInt(zone.Room_Count) || 0
      });
      imported.push(created);
    }

    return Response.json({
      success: true,
      imported_count: imported.length,
      zones: imported
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});