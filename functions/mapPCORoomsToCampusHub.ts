import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Maps PCO bookable rooms to Campus Hub rooms by matching names.
 * Creates a lightweight mapping between the two systems without requiring perfect matches.
 * Populates PCO_BookableRoom.campus_hub_room_id when a match is found.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user (admin only for safety)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'super_user') {
      return Response.json({ 
        error: 'Forbidden: Admin access required for mapping operations' 
      }, { status: 403 });
    }

    // Fetch all PCO bookable rooms and Campus Hub rooms
    const [pcoRooms, campusRooms] = await Promise.all([
      base44.asServiceRole.entities.PCO_BookableRoom.list(),
      base44.asServiceRole.entities.Room.list()
    ]);

    const results = {
      total_pco_rooms: pcoRooms.length,
      total_campus_rooms: campusRooms.length,
      mapped: 0,
      unmapped: 0,
      updated: 0,
      mappings: []
    };

    // Normalize room names for matching
    const normalize = (name) => {
      if (!name) return '';
      return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '') // Remove special chars and spaces
        .replace(/room|rm|area|space/g, ''); // Remove common words
    };

    // Create a map of normalized Campus Hub room names to room IDs
    const campusRoomMap = new Map();
    campusRooms.forEach(room => {
      const normalizedName = normalize(room.room_name || room.room_number);
      if (normalizedName) {
        // Handle collisions by storing arrays
        if (!campusRoomMap.has(normalizedName)) {
          campusRoomMap.set(normalizedName, []);
        }
        campusRoomMap.get(normalizedName).push(room);
      }
    });

    // Try to match each PCO room
    for (const pcoRoom of pcoRooms) {
      const normalizedPcoName = normalize(pcoRoom.name);
      
      if (!normalizedPcoName) {
        results.unmapped++;
        continue;
      }

      // Try exact normalized match first
      let matchedRooms = campusRoomMap.get(normalizedPcoName);

      // If no exact match, try partial matches
      if (!matchedRooms || matchedRooms.length === 0) {
        // Look for rooms where either name contains the other (after normalization)
        matchedRooms = campusRooms.filter(campusRoom => {
          const campusNormalized = normalize(campusRoom.room_name || campusRoom.room_number);
          return campusNormalized.includes(normalizedPcoName) || 
                 normalizedPcoName.includes(campusNormalized);
        });
      }

      // If we found exactly one match, create the mapping
      if (matchedRooms && matchedRooms.length === 1) {
        const campusRoom = matchedRooms[0];
        
        // Update PCO_BookableRoom with campus_hub_room_id
        await base44.asServiceRole.entities.PCO_BookableRoom.update(pcoRoom.id, {
          campus_hub_room_id: campusRoom.id
        });

        // Update Campus Hub Room with bookable flag
        await base44.asServiceRole.entities.Room.update(campusRoom.id, {
          bookable: true
        });

        results.mapped++;
        results.updated++;
        results.mappings.push({
          pco_room: pcoRoom.name,
          campus_room: campusRoom.room_name || campusRoom.room_number,
          campus_room_id: campusRoom.id
        });
      } else if (matchedRooms && matchedRooms.length > 1) {
        // Multiple matches - log for manual review but don't auto-map
        results.unmapped++;
        results.mappings.push({
          pco_room: pcoRoom.name,
          status: 'multiple_matches',
          possible_matches: matchedRooms.map(r => ({
            id: r.id,
            name: r.room_name || r.room_number
          }))
        });
      } else {
        // No match found
        results.unmapped++;
        results.mappings.push({
          pco_room: pcoRoom.name,
          status: 'no_match'
        });
      }
    }

    // Mark all unmapped Campus Hub rooms as not bookable
    const mappedCampusRoomIds = new Set(
      results.mappings
        .filter(m => m.campus_room_id)
        .map(m => m.campus_room_id)
    );

    for (const campusRoom of campusRooms) {
      if (!mappedCampusRoomIds.has(campusRoom.id) && campusRoom.bookable !== false) {
        await base44.asServiceRole.entities.Room.update(campusRoom.id, {
          bookable: false
        });
      }
    }

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error mapping PCO rooms to Campus Hub:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});