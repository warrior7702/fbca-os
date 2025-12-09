import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Helper to parse level number from floor name
function parseLevelNumber(floorName) {
  if (!floorName) return null;
  const lower = floorName.toLowerCase();
  
  if (lower.includes('first') || lower.includes('1st')) return 1;
  if (lower.includes('second') || lower.includes('2nd')) return 2;
  if (lower.includes('third') || lower.includes('3rd')) return 3;
  if (lower.includes('fourth') || lower.includes('4th')) return 4;
  if (lower.includes('fifth') || lower.includes('5th')) return 5;
  if (lower.includes('sixth') || lower.includes('6th')) return 6;
  if (lower.includes('seventh') || lower.includes('7th')) return 7;
  
  // Try to extract number
  const match = floorName.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  
  return null;
}

// Helper to parse CSV/TSV
function parseCSV(text, delimiter = ',') {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 401 });
    }

    const { floorsFileUrl, roomsFileUrl, assetsFileUrl } = await req.json();

    if (!floorsFileUrl || !roomsFileUrl || !assetsFileUrl) {
      return Response.json({ 
        error: 'Missing file URLs',
        details: 'Provide floorsFileUrl, roomsFileUrl, and assetsFileUrl'
      }, { status: 400 });
    }

    const summary = {
      buildingsCreated: 0,
      buildingsUpdated: 0,
      floorsCreated: 0,
      floorsUpdated: 0,
      roomsCreated: 0,
      roomsUpdated: 0,
      assetsCreated: 0,
      assetsUpdated: 0,
      assetGroupsCreated: 0,
      assetGroupsUpdated: 0,
      errors: []
    };

    // Fetch files
    console.log('Fetching floors file...');
    const floorsResponse = await fetch(floorsFileUrl);
    const floorsText = await floorsResponse.text();
    const floorsRows = parseCSV(floorsText);
    
    console.log('Fetching rooms file...');
    const roomsResponse = await fetch(roomsFileUrl);
    const roomsText = await roomsResponse.text();
    const roomsRows = parseCSV(roomsText);
    
    console.log('Fetching assets file...');
    const assetsResponse = await fetch(assetsFileUrl);
    const assetsText = await assetsResponse.text();
    const assetsRows = parseCSV(assetsText);

    console.log(`Parsed: ${floorsRows.length} floors, ${roomsRows.length} rooms, ${assetsRows.length} assets`);

    // Cache for lookups
    const buildingCache = new Map();
    const floorCache = new Map();
    const roomCache = new Map();
    const assetGroupCache = new Map();

    // Process Floors first (which creates Buildings)
    for (const row of floorsRows) {
      try {
        const buildingName = row['Building'] || row['building'];
        const floorId = row['_id'];
        const floorName = row['Name'] || row['name'];
        
        if (!floorId || !floorName) {
          summary.errors.push(`Floor missing ID or name: ${JSON.stringify(row)}`);
          continue;
        }

        // Upsert Building
        let building = buildingCache.get(buildingName);
        if (!building) {
          const existingBuildings = await base44.entities.Building.filter({ name: buildingName });
          if (existingBuildings.length > 0) {
            building = existingBuildings[0];
            buildingCache.set(buildingName, building);
            summary.buildingsUpdated++;
          } else {
            building = await base44.entities.Building.create({
              name: buildingName,
              akita_building_id: row['Building _id'] || row['building_id'] || ''
            });
            buildingCache.set(buildingName, building);
            summary.buildingsCreated++;
          }
        }

        // Upsert Floor
        const existingFloors = await base44.entities.Floor.filter({ akita_floor_id: floorId });
        const floorData = {
          akita_floor_id: floorId,
          name: floorName,
          level_number: parseLevelNumber(floorName),
          building_id: building.id,
          building_name: buildingName,
          akita_url: row['Url'] || row['url'] || '',
          portal_url: row['Portal URL'] || row['portal_url'] || '',
          updated_at: new Date().toISOString()
        };

        if (existingFloors.length > 0) {
          await base44.entities.Floor.update(existingFloors[0].id, floorData);
          floorCache.set(floorId, existingFloors[0].id);
          summary.floorsUpdated++;
        } else {
          floorData.created_at = new Date().toISOString();
          const newFloor = await base44.entities.Floor.create(floorData);
          floorCache.set(floorId, newFloor.id);
          summary.floorsCreated++;
        }
      } catch (err) {
        summary.errors.push(`Floor error: ${err.message}`);
      }
    }

    // Process Rooms
    for (const row of roomsRows) {
      try {
        const roomId = row['_id'];
        const buildingName = row['Building'];
        const floorName = row['Floor'];
        
        if (!roomId) {
          summary.errors.push(`Room missing ID: ${JSON.stringify(row)}`);
          continue;
        }

        // Find building
        let building = buildingCache.get(buildingName);
        if (!building) {
          const existingBuildings = await base44.entities.Building.filter({ name: buildingName });
          if (existingBuildings.length > 0) {
            building = existingBuildings[0];
            buildingCache.set(buildingName, building);
          } else {
            building = await base44.entities.Building.create({
              name: buildingName
            });
            buildingCache.set(buildingName, building);
            summary.buildingsCreated++;
          }
        }

        // Find floor by name and building
        let floorId = null;
        const floors = await base44.entities.Floor.filter({ 
          building_id: building.id,
          name: floorName
        });
        if (floors.length > 0) {
          floorId = floors[0].id;
        }

        // Upsert Room
        const existingRooms = await base44.entities.Room.filter({ akita_room_id: roomId });
        const roomData = {
          akita_room_id: roomId,
          room_number: row['Number'] || '',
          room_name: row['Name'] || '',
          room_category: row['Room Category'] || '',
          floor_id: floorId,
          floor_name: floorName,
          building_id: building.id,
          building_name: buildingName,
          square_feet: row['Square Feet'] || '',
          type: row['Type'] || '',
          floor_type: row['Floor Type'] || '',
          verified: row['Verified'] === 'Verified',
          description: row['Description'] || '',
          occupant: row['Occupant'] || '',
          status: row['Status'] || 'Active',
          decommissioned_date: row['Decommissioned Date'] || null,
          akita_url: row['Url'] || '',
          portal_url: row['Portal URL'] || '',
          updated_at: new Date().toISOString(),
          updated_by: user.email
        };

        if (existingRooms.length > 0) {
          await base44.entities.Room.update(existingRooms[0].id, roomData);
          roomCache.set(roomId, existingRooms[0].id);
          summary.roomsUpdated++;
        } else {
          roomData.created_at = new Date().toISOString();
          roomData.created_by = user.email;
          const newRoom = await base44.entities.Room.create(roomData);
          roomCache.set(roomId, newRoom.id);
          summary.roomsCreated++;
        }
      } catch (err) {
        summary.errors.push(`Room error: ${err.message}`);
      }
    }

    // Process Assets
    for (const row of assetsRows) {
      try {
        const assetId = row['_id'];
        const assetCategory = row['Asset Category'];
        
        if (!assetId) {
          summary.errors.push(`Asset missing ID: ${JSON.stringify(row)}`);
          continue;
        }

        // Upsert AssetGroup
        let assetGroup = assetGroupCache.get(assetCategory);
        if (!assetGroup && assetCategory) {
          const existingGroups = await base44.entities.AssetGroup.filter({ name: assetCategory });
          if (existingGroups.length > 0) {
            assetGroup = existingGroups[0];
            assetGroupCache.set(assetCategory, assetGroup);
            summary.assetGroupsUpdated++;
          } else {
            assetGroup = await base44.entities.AssetGroup.create({
              name: assetCategory,
              description: `Asset category: ${assetCategory}`
            });
            assetGroupCache.set(assetCategory, assetGroup);
            summary.assetGroupsCreated++;
          }
        }

        // Find building
        const buildingName = row['Building'];
        let building = buildingCache.get(buildingName);
        if (!building) {
          const existingBuildings = await base44.entities.Building.filter({ name: buildingName });
          if (existingBuildings.length > 0) {
            building = existingBuildings[0];
            buildingCache.set(buildingName, building);
          }
        }

        // Find floor
        const floorAkitaId = row['Floor _id'];
        let floorId = floorCache.get(floorAkitaId);
        if (!floorId && floorAkitaId) {
          const floors = await base44.entities.Floor.filter({ akita_floor_id: floorAkitaId });
          if (floors.length > 0) {
            floorId = floors[0].id;
            floorCache.set(floorAkitaId, floorId);
          }
        }

        // Find room
        const roomAkitaId = row['Room Number _id'];
        let roomId = roomCache.get(roomAkitaId);
        if (!roomId && roomAkitaId) {
          const rooms = await base44.entities.Room.filter({ akita_room_id: roomAkitaId });
          if (rooms.length > 0) {
            roomId = rooms[0].id;
            roomCache.set(roomAkitaId, roomId);
          }
        }

        // Parse coordinates
        const xCoord = row['X Coordinate'] ? parseFloat(row['X Coordinate']) : null;
        const yCoord = row['Y Coordinate'] ? parseFloat(row['Y Coordinate']) : null;

        // Upsert Asset
        const existingAssets = await base44.entities.Asset.filter({ akita_asset_id: assetId });
        const assetData = {
          akita_asset_id: assetId,
          name: row['Name'] || 'Unnamed Asset',
          asset_category: assetCategory || '',
          asset_group_id: assetGroup?.id || null,
          organization_name: row['Organization'] || '',
          building_id: building?.id || null,
          building_name: buildingName || '',
          building_akita_id: row['Building _id'] || '',
          building_group: row['Building Group'] || '',
          building_group_id: row['Building Group _id'] || '',
          floor_id: floorId || null,
          floor_name: row['Floor'] || '',
          floor_akita_id: floorAkitaId || '',
          room_id: roomId || null,
          room_number: row['Room Number'] || '',
          room_akita_id: roomAkitaId || '',
          room_name: row['Room Name'] || '',
          type: row['Type'] || '',
          asset_id_number: row['ID'] || '',
          manufacturer: row['Manufacturer'] || '',
          model: row['Model'] || '',
          serial_number: row['Serial Number'] || '',
          description: row['Description'] || '',
          condition: row['Condition'] || '',
          condition_date: row['Condition Date'] || null,
          installation_date: row['Installation Date'] || null,
          warranty_expiration_date: row['Warranty Expiration Date'] || null,
          verified: row['Verified'] === 'Verified',
          status: row['Status'] || 'Active',
          decommissioned_date: row['Decommissioned Date'] || null,
          website_url: row['Website'] || '',
          om_manuals: row['OM Manuals'] || '',
          warranty_notes: row['Warranty'] || '',
          cost: row['Cost'] ? parseFloat(row['Cost']) : null,
          total_cost: row['Total Cost'] ? parseFloat(row['Total Cost']) : null,
          number: row['Number'] || '',
          akita_url: row['Url'] || '',
          x_coord: xCoord,
          y_coord: yCoord,
          qr_code: row['QR Code'] || '',
          updated_at: new Date().toISOString(),
          updated_by: user.email
        };

        if (existingAssets.length > 0) {
          await base44.entities.Asset.update(existingAssets[0].id, assetData);
          summary.assetsUpdated++;
        } else {
          assetData.created_at = new Date().toISOString();
          assetData.created_by = user.email;
          await base44.entities.Asset.create(assetData);
          summary.assetsCreated++;
        }
      } catch (err) {
        summary.errors.push(`Asset error: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});