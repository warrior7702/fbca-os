import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { fetchPCO } from './utils/pcoConfig.js';

const A = (x) => Array.isArray(x) ? x : [];

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
            client_id: Deno.env.get('PCO_CLIENT_ID'),
            client_secret: Deno.env.get('PCO_CLIENT_SECRET')
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
    console.log('🔄 Syncing PCO Bookable Rooms...');
    
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = A(users)[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ 
                error: 'PCO not connected'
            }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Fetch all rooms from PCO
        console.log('📝 Fetching rooms from PCO...');
        let allRooms = [];
        let nextUrl = '/calendar/v2/rooms?per_page=100';
        
        while (nextUrl) {
            const roomsResponse = await fetchPCO(base44, nextUrl, accessToken);

            if (!roomsResponse.ok) {
                throw new Error(`Failed to fetch rooms: ${roomsResponse.status}`);
            }

            const roomsData = await roomsResponse.json();
            allRooms = allRooms.concat(A(roomsData.data));
            nextUrl = roomsData.links?.next || null;
        }

        console.log(`✅ Found ${allRooms.length} rooms in PCO`);

        // Upsert rooms to PCO_BookableRoom
        let upsertedCount = 0;
        for (const room of allRooms) {
            try {
                const existingRooms = await base44.asServiceRole.entities.PCO_BookableRoom.filter({
                    pco_room_id: room.id
                });

                const roomData = {
                    pco_room_id: room.id,
                    name: room.attributes?.name || 'Unnamed Room',
                    campus: room.attributes?.campus || null,
                    location: room.attributes?.location || null,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                    raw_json: room
                };

                if (A(existingRooms).length > 0) {
                    await base44.asServiceRole.entities.PCO_BookableRoom.update(
                        existingRooms[0].id,
                        roomData
                    );
                } else {
                    await base44.asServiceRole.entities.PCO_BookableRoom.create(roomData);
                }

                upsertedCount++;
            } catch (error) {
                console.error(`Error upserting room ${room.id}:`, error);
            }
        }

        console.log(`✅ Upserted ${upsertedCount} rooms to PCO_BookableRoom`);

        return Response.json({
            success: true,
            rooms_synced: upsertedCount,
            total_rooms: allRooms.length
        });

    } catch (error) {
        console.error('❌ Error in syncPCOBookableRooms:', error);
        return Response.json({ 
            error: error.message
        }, { status: 500 });
    }
});