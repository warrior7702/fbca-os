import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all unassigned rooms
    const allRooms = await base44.asServiceRole.entities.Room.list();
    const unassignedRooms = allRooms.filter(r => 
      !r.cleaning_schedule || r.cleaning_schedule === 'unknown'
    );

    const results = {
      not_cleaned: 0,
      daily: 0,
      vip: 0,
      mon_wed_full_clean: 0
    };

    const DELAY_MS = 100;

    for (let i = 0; i < unassignedRooms.length; i++) {
      const room = unassignedRooms[i];
      const roomName = (room.room_name || '').toLowerCase();
      let schedule = 'mon_wed_full_clean'; // Default

      // NOT_CLEANED (Infrastructure & Exterior)
      const notCleanedKeywords = [
        'exterior', 'ext', 'stair', 'elevator', 'mechanical', 'hvac', 
        'electrical', 'chiller', 'pump room', 'control room', 'mdf', 
        'roof', 'attic', 'penthouse', 'balcony', 'covered walkway', 'storage'
      ];
      
      if (roomName === '-' || roomName === '' || 
          notCleanedKeywords.some(kw => roomName.includes(kw))) {
        schedule = 'not_cleaned';
      }
      // DAILY (High-Traffic Public Areas)
      else {
        const dailyKeywords = [
          'restroom', 'kitchen', 'lobby', 'commons', 'hallway', 'hall', 
          'courtyard', 'entrance', 'vestibule', 'rotunda', 'locker room', 
          'resource center', 'coffee', 'stage', 'waiting'
        ];
        
        if (dailyKeywords.some(kw => roomName.includes(kw))) {
          schedule = 'daily';
        }
        // VIP (Special/Suite Areas)
        else {
          const vipKeywords = ['suite', 'ste-', 'parlor'];
          
          if (vipKeywords.some(kw => roomName.includes(kw))) {
            schedule = 'vip';
          }
        }
      }

      // Update room
      await base44.asServiceRole.entities.Room.update(room.id, {
        cleaning_schedule: schedule
      });

      results[schedule]++;

      // Delay between updates
      if (i < unassignedRooms.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    return Response.json({
      success: true,
      total_processed: unassignedRooms.length,
      assignments: results
    });

  } catch (error) {
    console.error('Auto-assign error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});