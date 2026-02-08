import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== ROOM PCO MAPPING DIAGNOSTIC ===\n');

    // Task 1: Get a sample room from PCB
    const pcbRooms = await base44.entities.Room.filter({
      building_id: "69379780c898f5437d4f02d1"
    });
    
    if (pcbRooms.length > 0) {
      const sampleRoom = pcbRooms[0];
      console.log('=== TASK 1: SAMPLE ROOM RECORD ===');
      console.log(JSON.stringify(sampleRoom, null, 2));
      console.log('\nFields available:', Object.keys(sampleRoom));
      console.log('Has pco_resource_id?', 'pco_resource_id' in sampleRoom);
      console.log('Has resource_id?', 'resource_id' in sampleRoom);
      console.log('Has pco_id?', 'pco_id' in sampleRoom);
      console.log('Has pco_bookable_resource_id?', 'pco_bookable_resource_id' in sampleRoom);
    }

    // Task 2: Get all rooms and check PCO ID fields
    const allRooms = await base44.entities.Room.list();
    
    console.log('\n=== TASK 2: ROOM PCO ID CHECK (First 10 rooms) ===');
    allRooms.slice(0, 10).forEach(room => {
      console.log(`\nRoom ${room.room_number || room.name}:`);
      console.log('  room_id:', room.id);
      console.log('  pco_resource_id:', room.pco_resource_id);
      console.log('  resource_id:', room.resource_id);
      console.log('  pco_id:', room.pco_id);
      console.log('  pco_bookable_resource_id:', room.pco_bookable_resource_id);
      console.log('  All fields:', Object.keys(room));
    });

    // Task 3: Count rooms with PCO IDs
    const roomsWithPCOId = allRooms.filter(r => 
      r.pco_resource_id || r.resource_id || r.pco_id || r.pco_bookable_resource_id
    );
    
    console.log('\n=== TASK 3: PCO ID STATISTICS ===');
    console.log('Total rooms:', allRooms.length);
    console.log('Rooms with any PCO ID field:', roomsWithPCOId.length);
    console.log('Rooms with pco_resource_id:', allRooms.filter(r => r.pco_resource_id).length);
    console.log('Rooms with resource_id:', allRooms.filter(r => r.resource_id).length);
    console.log('Rooms with pco_id:', allRooms.filter(r => r.pco_id).length);
    console.log('Rooms with pco_bookable_resource_id:', allRooms.filter(r => r.pco_bookable_resource_id).length);

    // Task 4: Show sample PCO IDs if they exist
    if (roomsWithPCOId.length > 0) {
      console.log('\n=== TASK 4: SAMPLE PCO ID VALUES ===');
      roomsWithPCOId.slice(0, 5).forEach(room => {
        console.log(`\nRoom: ${room.name || room.room_number}`);
        if (room.pco_resource_id) console.log('  pco_resource_id:', room.pco_resource_id);
        if (room.resource_id) console.log('  resource_id:', room.resource_id);
        if (room.pco_id) console.log('  pco_id:', room.pco_id);
        if (room.pco_bookable_resource_id) console.log('  pco_bookable_resource_id:', room.pco_bookable_resource_id);
      });
    }

    return Response.json({
      success: true,
      summary: {
        total_rooms: allRooms.length,
        rooms_with_pco_id: roomsWithPCOId.length,
        fields_found: {
          pco_resource_id: allRooms.filter(r => r.pco_resource_id).length,
          resource_id: allRooms.filter(r => r.resource_id).length,
          pco_id: allRooms.filter(r => r.pco_id).length,
          pco_bookable_resource_id: allRooms.filter(r => r.pco_bookable_resource_id).length
        }
      },
      sample_rooms: roomsWithPCOId.slice(0, 3)
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});