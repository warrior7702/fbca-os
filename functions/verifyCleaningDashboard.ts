import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getRoomTemperature(room) {
  const schedule = room.cleaning_schedule;
  const lastCleaned = room.last_cleaned_at;
  const now = new Date();
  
  if (!lastCleaned) return 'HOT';
  
  const lastCleanedDate = new Date(lastCleaned);
  const hoursSinceClean = (now - lastCleanedDate) / (1000 * 60 * 60);
  
  switch(schedule) {
    case 'daily':
      if (hoursSinceClean > 24) return 'HOT';
      if (hoursSinceClean > 18) return 'WARM';
      return 'COOL';
      
    case 'mon_wed_full_clean':
      const lastMonday = new Date(now);
      const day = lastMonday.getDay();
      const diff = day === 0 ? 6 : day - 1;
      lastMonday.setDate(lastMonday.getDate() - diff);
      if (lastCleanedDate < lastMonday) return 'HOT';
      if (hoursSinceClean / 24 > 2) return 'WARM';
      return 'COOL';
      
    case 'vip':
      if (hoursSinceClean > 72) return 'HOT';
      if (hoursSinceClean > 48) return 'WARM';
      return 'COOL';
      
    case 'not_cleaned':
      return 'COOL';
      
    default:
      return 'COOL';
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {};

    // TEST 1: Find Sanctuary room
    console.log('[TEST 1] Finding Sanctuary room...');
    const allRooms = await base44.asServiceRole.entities.Room.list();
    const sanctuary = allRooms.find(r => r.room_name?.toLowerCase().includes('sanctuary'));
    
    if (!sanctuary) {
      results.test1 = {
        status: 'FAILED',
        message: 'Sanctuary room not found',
        available_rooms: allRooms.map(r => ({ id: r.id, name: r.room_name, number: r.room_number })).slice(0, 5)
      };
    } else {
      results.test1 = {
        status: 'PASSED',
        id: sanctuary.id,
        name: sanctuary.room_name,
        number: sanctuary.room_number,
        schedule: sanctuary.cleaning_schedule,
        last_cleaned: sanctuary.last_cleaned_at,
        is_bookable: sanctuary.is_bookable,
        building: sanctuary.building_name
      };
    }

    if (sanctuary) {
      // TEST 2: Check temperature
      console.log('[TEST 2] Checking Sanctuary temperature...');
      const temp = getRoomTemperature(sanctuary);
      results.test2 = {
        status: 'PASSED',
        temperature: temp,
        schedule: sanctuary.cleaning_schedule,
        hours_since_clean: sanctuary.last_cleaned_at 
          ? Math.round((new Date() - new Date(sanctuary.last_cleaned_at)) / (1000 * 60 * 60))
          : 'Never cleaned',
        expected: 'HOT or WARM for VIP room never/rarely cleaned'
      };

      // TEST 3: Verify warning would generate
      console.log('[TEST 3] Checking warning generation...');
      if (temp === 'COOL') {
        results.test3 = {
          status: 'SKIPPED',
          message: 'Room temperature is COOL - no warning needed'
        };
      } else {
        const acks = await base44.asServiceRole.entities.CleaningAcknowledgment.filter({
          room_id: sanctuary.id,
          auto_cleared: false
        });
        const hasActiveAck = acks.length > 0;
        
        results.test3 = {
          status: 'PASSED',
          would_generate_warning: !hasActiveAck,
          active_acknowledgments: acks.length,
          latest_ack: acks.length > 0 ? acks[0].acknowledged_at : null
        };
      }

      // TEST 4: Verify CleaningLog functionality
      console.log('[TEST 4] Checking CleaningLog records...');
      const logs = await base44.asServiceRole.entities.CleaningLog.filter({
        room_id: sanctuary.id
      }, '-performed_at', 5);
      
      results.test4 = {
        status: 'PASSED',
        total_cleaning_logs: logs.length,
        recent_logs: logs.map(log => ({
          action: log.action,
          performed_by: log.performed_by_name,
          performed_at: log.performed_at
        }))
      };
    }

    return Response.json({
      success: true,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      tests: results
    });

  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});