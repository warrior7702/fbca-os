import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all rooms and zones
    const allRooms = await base44.asServiceRole.entities.Room.list();
    const allZones = await base44.asServiceRole.entities.CleaningZone.list();

    // Calculate totals
    const totalRooms = allRooms.length;
    const assigned = allRooms.filter(r => 
      r.cleaning_schedule && r.cleaning_schedule !== 'unknown'
    ).length;
    const unassigned = totalRooms - assigned;

    // Distribution breakdown
    const distribution = {};
    allRooms.forEach(room => {
      const schedule = room.cleaning_schedule || 'unassigned';
      distribution[schedule] = (distribution[schedule] || 0) + 1;
    });

    // Sort by count
    const sortedDistribution = Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    return Response.json({
      success: true,
      totals: {
        total_rooms: totalRooms,
        assigned,
        unassigned
      },
      distribution: sortedDistribution,
      total_zones: allZones.length,
      completion_percentage: Math.round((assigned / totalRooms) * 100)
    });

  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});