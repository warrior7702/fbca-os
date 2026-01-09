import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshPCOToken(base44, user) {
  const expiresAt = new Date(user.pco_expires_at);
  const now = new Date();
  const bufferMinutes = 10;
  
  if (expiresAt - now < bufferMinutes * 60 * 1000) {
    const response = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: user.pco_refresh_token,
        client_id: Deno.env.get('PCO_CLIENT_ID'),
        client_secret: Deno.env.get('PCO_CLIENT_SECRET')
      })
    });
    
    if (!response.ok) throw new Error('Failed to refresh PCO token');
    
    const tokens = await response.json();
    await base44.auth.updateMe({
      pco_access_token: tokens.access_token,
      pco_refresh_token: tokens.refresh_token,
      pco_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.pco_access_token;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const logs = [];
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Get user with PCO token
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      logs.push('No authenticated user - using service role');
      const users = await base44.asServiceRole.entities.User.list();
      user = users.find(u => u.pco_access_token);
    }
    
    if (!user || !user.pco_access_token) {
      return Response.json({
        success: false,
        error: 'No PCO connection found',
        logs
      });
    }
    
    const accessToken = await refreshPCOToken(base44.asServiceRole, user);
    logs.push('PCO token refreshed');
    
    // Fetch all rooms from PCO (use /rooms endpoint, not /resources)
    let allRooms = [];
    let nextUrl = 'https://api.planningcenteronline.com/calendar/v2/rooms?per_page=100';
    
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        throw new Error(`PCO API error: ${response.status}`);
      }
      
      const data = await response.json();
      allRooms = allRooms.concat(data.data || []);
      nextUrl = data.links?.next || null;
    }
    
    logs.push(`Fetched ${allRooms.length} rooms from PCO`);
    
    // Get all Campus Hub rooms
    const campusHubRooms = await base44.asServiceRole.entities.Room.list();
    logs.push(`Found ${campusHubRooms.length} rooms in Campus Hub`);
    
    let matched = 0;
    let unmatched = 0;
    let updated = 0;
    const unmatchedRooms = [];
    
    // Process each PCO room
    for (const pcoRoom of allRooms) {
      const pcoRoomId = pcoRoom.id;
      const pcoRoomName = pcoRoom.attributes?.name || 'Unknown';
      // PCO doesn't return bookable attribute when true - only when false
      const isBookable = pcoRoom.attributes?.bookable !== false;
      
      // Try to find matching Campus Hub room by pco_resource_id
      let campusRoom = campusHubRooms.find(r => r.pco_resource_id === pcoRoomId);
      
      // If no direct match, try fuzzy matching by name
      if (!campusRoom) {
        const normalizedPCOName = pcoRoomName.toLowerCase().replace(/[^a-z0-9]/g, '');
        campusRoom = campusHubRooms.find(r => {
          const normalizedCampusName = (r.room_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedCampusName === normalizedPCOName;
        });
      }
      
      if (campusRoom) {
        // Update Campus Hub room with PCO bookable status
        try {
          await base44.asServiceRole.entities.Room.update(campusRoom.id, {
            pco_resource_id: pcoRoomId,
            is_bookable: isBookable,
            bookable_source: 'PCO',
            last_pco_sync_at: new Date().toISOString()
          });
          matched++;
          updated++;
        } catch (err) {
          logs.push(`Error updating room ${campusRoom.room_number}: ${err.message}`);
        }
      } else {
        unmatched++;
        unmatchedRooms.push({
          pco_id: pcoRoomId,
          pco_name: pcoRoomName,
          is_bookable: isBookable
        });
      }
    }
    
    logs.push(`Matched: ${matched}, Unmatched: ${unmatched}, Updated: ${updated}`);
    
    const durationMs = Date.now() - startTime;
    
    return Response.json({
      success: true,
      stats: {
        pco_rooms_total: allRooms.length,
        campus_hub_rooms_total: campusHubRooms.length,
        matched,
        unmatched,
        updated
      },
      unmatched_pco_rooms: unmatchedRooms,
      duration_ms: durationMs,
      logs
    });
    
  } catch (error) {
    console.error('syncBookableRoomsFromPCO error:', error);
    logs.push(`ERROR: ${error.message}`);
    
    return Response.json({
      success: false,
      error: error.message,
      logs,
      duration_ms: Date.now() - startTime
    }, { status: 500 });
  }
});