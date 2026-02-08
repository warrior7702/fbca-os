import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshTokenIfNeeded(base44, user) {
  const expiresAt = new Date(user.pco_token_expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return user.pco_access_token;
  }

  const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.pco_refresh_token,
      client_id: Deno.env.get('PCO_CLIENT_ID') || '',
      client_secret: Deno.env.get('PCO_CLIENT_SECRET') || ''
    })
  });

  if (!tokenResponse.ok) throw new Error('Token refresh failed');

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

  await base44.asServiceRole.entities.User.update(user.id, {
    pco_access_token: tokens.access_token,
    pco_refresh_token: tokens.refresh_token,
    pco_token_expires_at: newExpiresAt
  });

  return tokens.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, user);

    // Fetch ALL bookable rooms from PCO
    console.log('Fetching bookable rooms from PCO...');
    const bookableRoomsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/resources?filter=room&per_page=100',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!bookableRoomsResponse.ok) {
      throw new Error(`Failed to fetch bookable rooms: ${bookableRoomsResponse.status}`);
    }

    const bookableRoomsData = await bookableRoomsResponse.json();
    const pcoBookableRooms = bookableRoomsData.data || [];
    
    console.log('Total PCO bookable rooms:', pcoBookableRooms.length);

    // Fetch all rooms from database
    const allRooms = await base44.entities.Room.list();
    console.log('Total database rooms:', allRooms.length);

    // Fetch all buildings
    const buildings = await base44.entities.Building.list();
    
    // Create map of PCO resource ID to room
    const pcoIdToRoom = {};
    for (const room of allRooms) {
      if (room.pco_resource_id) {
        pcoIdToRoom[room.pco_resource_id] = room;
      }
    }

    // Count matched PCO bookable rooms per building
    const buildingStats = {};
    
    for (const building of buildings) {
      buildingStats[building.id] = {
        building_id: building.id,
        building_name: building.name,
        pco_bookable_rooms_matched: 0,
        matched_rooms: []
      };
    }

    let totalMatched = 0;
    const unmatchedPCORooms = [];

    for (const pcoRoom of pcoBookableRooms) {
      const room = pcoIdToRoom[pcoRoom.id];
      
      if (room && room.building_id && buildingStats[room.building_id]) {
        buildingStats[room.building_id].pco_bookable_rooms_matched++;
        buildingStats[room.building_id].matched_rooms.push({
          pco_id: pcoRoom.id,
          pco_name: pcoRoom.attributes?.name,
          room_id: room.id,
          room_name: room.room_name || room.room_number
        });
        totalMatched++;
      } else {
        unmatchedPCORooms.push({
          pco_id: pcoRoom.id,
          pco_name: pcoRoom.attributes?.name
        });
      }
    }

    const buildingsArray = Object.values(buildingStats).sort((a, b) => 
      b.pco_bookable_rooms_matched - a.pco_bookable_rooms_matched
    );

    return Response.json({
      success: true,
      summary: {
        total_pco_bookable_rooms: pcoBookableRooms.length,
        total_matched_to_database: totalMatched,
        total_unmatched: unmatchedPCORooms.length
      },
      buildings: buildingsArray,
      unmatched_pco_rooms: unmatchedPCORooms.slice(0, 10)
    });

  } catch (error) {
    console.error('Error in getPCOBookableRoomsByBuilding:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});