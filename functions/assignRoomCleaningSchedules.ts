import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Zone cleaning schedule mapping based on floor plan PDFs
const ZONE_DEFINITIONS = {
  // Main Church
  'Main Church_1': {
    default: 'overnight_event_monday', // Light blue - cleaned Mon overnight + events, Sun trash only
    vip: 'vip_day_porter', // Pink - VIP areas
    daily: 'daily', // Green - checked/cleaned daily
    not_cleaned: 'not_cleaned' // Red - not cleaned
  },
  'Main Church_2': {
    default: 'overnight_event_monday',
    daily: 'daily',
    not_cleaned: 'not_cleaned'
  },
  'Main Church_3': {
    default: 'overnight_event_monday',
    daily: 'daily',
    not_cleaned: 'not_cleaned'
  },
  
  // Wade Building
  'Wade Building_1': {
    default: 'mon_wed_full_clean', // Green - Mon & Wed full clean, Fri trash/restrooms
    vip: 'vip_day_porter' // Pink - VIP
  },
  'Wade Building_2': {
    default: 'mon_wed_full_clean',
    vip: 'vip_day_porter'
  },
  'Wade Building_3': {
    default: 'mon_wed_full_clean'
  },
  'Wade Building_4': {
    default: 'mon_wed_full_clean',
    not_cleaned: 'not_cleaned'
  },
  'Wade Building_5': {
    default: 'mon_wed_full_clean'
  },
  
  // Student Center
  'Student Center_1': {
    default: 'overnight_event_mon_fri', // Light blue - Mon & Fri + events, Sun trash
    not_cleaned: 'not_cleaned'
  },
  'Student Center_2': {
    default: 'overnight_event_mon_fri',
    not_cleaned: 'not_cleaned'
  },
  
  // PCB (Preschool/Children's Building)
  'PCB_1': {
    default: 'overnight_event_sunday_fri', // Beige - Sun-Fri overnight + events
    vip: 'vip_day_porter' // Pink - VIP
  },
  'PCB_2': {
    default: 'overnight_event_monday', // Light blue - Mon overnight + events
    vip: 'vip_day_porter'
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    // Load all rooms
    const rooms = await base44.asServiceRole.entities.Room.list();
    
    let updated = 0;
    let vipOrUnknown = 0;
    const updates = [];
    
    for (const room of rooms) {
      if (!room.building || !room.floor_number) {
        console.log(`Skipping room ${room.name} - missing building or floor`);
        continue;
      }
      
      // Create zone key
      const zoneKey = `${room.building}_${room.floor_number}`;
      const zoneDef = ZONE_DEFINITIONS[zoneKey];
      
      if (!zoneDef) {
        console.log(`No zone definition found for ${zoneKey}`);
        updates.push({
          id: room.id,
          name: room.name,
          building: room.building,
          floor: room.floor_number,
          schedule: 'unknown',
          reason: 'No zone definition'
        });
        continue;
      }
      
      // Assign default schedule
      // VIP and not_cleaned zones need manual review
      let schedule = zoneDef.default;
      let needsReview = false;
      
      if (zoneDef.vip || zoneDef.not_cleaned) {
        schedule = 'unknown';
        needsReview = true;
        vipOrUnknown++;
      }
      
      // Update room
      await base44.asServiceRole.entities.Room.update(room.id, {
        cleaning_schedule: schedule,
        zone_id: null // Will be populated when zones are manually mapped
      });
      
      updates.push({
        id: room.id,
        name: room.name,
        building: room.building,
        floor: room.floor_number,
        schedule: schedule,
        needsReview: needsReview
      });
      
      updated++;
    }
    
    return Response.json({
      success: true,
      totalRooms: rooms.length,
      updated: updated,
      needsManualReview: vipOrUnknown,
      updates: updates
    });
    
  } catch (error) {
    console.error('Error assigning cleaning schedules:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});