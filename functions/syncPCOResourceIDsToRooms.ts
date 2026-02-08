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

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with PCO tokens
    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, user);

    console.log('=== SYNCING PCO RESOURCE IDs TO ROOMS ===\n');

    // Step 1: Fetch all bookable room resources from PCO
    const pcoResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/resources?filter=room&per_page=100',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!pcoResponse.ok) {
      throw new Error(`PCO API error: ${pcoResponse.status}`);
    }

    const pcoData = await pcoResponse.json();
    const pcoResources = pcoData.data || [];
    
    console.log('PCO bookable rooms fetched:', pcoResources.length);

    // Step 2: Get all database rooms
    const dbRooms = await base44.asServiceRole.entities.Room.list();
    console.log('Database rooms:', dbRooms.length);

    // Step 3: Match and update
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const matchLog = [];
    const unmatchedLog = [];

    for (const pcoResource of pcoResources) {
      const pcoRoomName = pcoResource.attributes?.name || '';
      const pcoResourceId = pcoResource.id;

      // Try to find matching room by name (case insensitive)
      const dbRoom = dbRooms.find(room => {
        const roomName = (room.room_name || '').toLowerCase().trim();
        const roomNumber = (room.room_number || '').toLowerCase().trim();
        const pcoName = pcoRoomName.toLowerCase().trim();

        return roomName === pcoName || roomNumber === pcoName || 
               roomName.includes(pcoName) || pcoName.includes(roomName);
      });

      if (dbRoom) {
        // Check if already has this PCO ID
        if (dbRoom.pco_resource_id === pcoResourceId) {
          skipped++;
          continue;
        }

        // Update with PCO resource ID
        await base44.asServiceRole.entities.Room.update(dbRoom.id, {
          pco_resource_id: pcoResourceId,
          is_bookable: true,
          bookable_source: 'PCO'
        });

        const logEntry = `✓ Matched: "${pcoRoomName}" → Room ${dbRoom.room_number || dbRoom.room_name} → PCO ID ${pcoResourceId}`;
        console.log(logEntry);
        matchLog.push(logEntry);
        matched++;
      } else {
        const logEntry = `✗ No match: "${pcoRoomName}" (PCO ID: ${pcoResourceId})`;
        console.log(logEntry);
        unmatchedLog.push(logEntry);
        unmatched++;
      }
    }

    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Matched: ${matched}`);
    console.log(`Unmatched: ${unmatched}`);
    console.log(`Skipped (already synced): ${skipped}`);

    // Verify results
    const roomsWithPCOId = await base44.asServiceRole.entities.Room.filter({
      pco_resource_id: { $ne: null }
    });

    console.log(`\nTotal rooms with PCO ID after sync: ${roomsWithPCOId.length}`);

    return Response.json({
      success: true,
      summary: {
        matched,
        unmatched,
        skipped,
        total_pco_resources: pcoResources.length,
        rooms_with_pco_id: roomsWithPCOId.length
      },
      matched_rooms: matchLog,
      unmatched_pco_resources: unmatchedLog
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});