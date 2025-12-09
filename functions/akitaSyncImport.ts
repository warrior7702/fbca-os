import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as XLSX from 'npm:xlsx@0.18.5';

// Helper to parse TSV text
function parseTSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Helper to extract AkitaBox ID from URL
function extractIdFromUrl(url, type = 'buildings') {
  if (!url) return null;
  const match = url.match(new RegExp(`/${type}/([a-f0-9]+)`));
  return match ? match[1] : null;
}

// Helper to normalize name for slug
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Helper to parse level number from floor name
function parseLevelNumber(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  
  const ordinals = {
    'first': 1, '1st': 1,
    'second': 2, '2nd': 2,
    'third': 3, '3rd': 3,
    'fourth': 4, '4th': 4,
    'fifth': 5, '5th': 5,
    'sixth': 6, '6th': 6,
    'seventh': 7, '7th': 7,
  };
  
  for (const [key, val] of Object.entries(ordinals)) {
    if (lower.includes(key)) return val;
  }
  
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

Deno.serve(async (req) => {
  let base44;
  let user;
  
  try {
    // Initialize Base44 client
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({
        success: false,
        error: 'Unauthorized - admin only'
      }, { status: 401 });
    }
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({
        success: false,
        error: 'Invalid JSON body',
        details: e.message
      }, { status: 400 });
    }
    
    const { floorsFileId, roomsFileId, assetsFileId, skipRows = 0, limitRows = null } = body;
    
    // Validate at least one file provided
    if (!floorsFileId && !roomsFileId && !assetsFileId) {
      return Response.json({
        success: false,
        error: 'At least one file ID must be provided (floorsFileId, roomsFileId, or assetsFileId)'
      }, { status: 400 });
    }
    
    console.log('Starting import...');
    console.log(`Floors: ${floorsFileId || 'none'}`);
    console.log(`Rooms: ${roomsFileId || 'none'}`);
    console.log(`Assets: ${assetsFileId || 'none'}`);
    
    const summary = {
      buildingsCreated: 0,
      buildingsUpdated: 0,
      floorsCreated: 0,
      floorsUpdated: 0,
      roomsCreated: 0,
      roomsUpdated: 0,
      assetsCreated: 0,
      assetsUpdated: 0,
      warnings: []
    };
    
    // Caches for lookups
    const buildingCache = new Map(); // name -> Building
    const floorCache = new Map(); // akita_level_id -> Floor
    const roomCache = new Map(); // akita_room_id -> Room
    const assetGroupCache = new Map(); // name -> AssetGroup
    
    // ============================================
    // PROCESS FLOORS FILE
    // ============================================
    if (floorsFileId) {
      try {
        console.log('Fetching floors file...');
        const floorsUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/${floorsFileId}`;
        const floorsResponse = await fetch(floorsUrl);
        
        if (!floorsResponse.ok) {
          summary.warnings.push(`Failed to fetch floors file: ${floorsResponse.statusText}`);
        } else {
          const arrayBuffer = await floorsResponse.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const floorsData = XLSX.utils.sheet_to_json(firstSheet);
          
          console.log(`Parsed ${floorsData.length} floors`);
          
          for (const row of floorsData) {
            try {
              const buildingName = row['Building'] || '';
              const levelId = row['_id'];
              const levelName = row['Name'] || '';
              const url = row['Url'] || '';
              const portalUrl = row['Portal URL'] || '';
              const floorPlanFile = row['Floor Plan'] || '';
              
              if (!levelId || !levelName) {
                summary.warnings.push(`Floor missing _id or Name: ${JSON.stringify(row)}`);
                continue;
              }
              
              // Upsert Building first
              let building = buildingCache.get(buildingName);
              if (!building) {
                const akitaBuildingId = extractIdFromUrl(url, 'buildings') || '';
                const existing = await base44.asServiceRole.entities.Building.filter({ name: buildingName });
                
                if (existing.length > 0) {
                  building = existing[0];
                  await base44.asServiceRole.entities.Building.update(building.id, {
                    akita_building_id: akitaBuildingId,
                    name: buildingName
                  });
                  summary.buildingsUpdated++;
                } else {
                  building = await base44.asServiceRole.entities.Building.create({
                    akita_building_id: akitaBuildingId,
                    name: buildingName,
                    address: null,
                    notes: null
                  });
                  summary.buildingsCreated++;
                }
                buildingCache.set(buildingName, building);
              }
              
              // Upsert Floor
              const existing = await base44.asServiceRole.entities.Floor.filter({ akita_level_id: levelId });
              const floorData = {
                akita_level_id: levelId,
                name: levelName,
                level_name: levelName,
                level_number: parseLevelNumber(levelName),
                floor_plan_file: floorPlanFile || null,
                building_id: building.id,
                building_name: buildingName,
                akita_url: url,
                portal_url: portalUrl,
                updated_at: new Date().toISOString()
              };
              
              if (existing.length > 0) {
                await base44.asServiceRole.entities.Floor.update(existing[0].id, floorData);
                floorCache.set(levelId, existing[0]);
                summary.floorsUpdated++;
              } else {
                floorData.created_at = new Date().toISOString();
                const newFloor = await base44.asServiceRole.entities.Floor.create(floorData);
                floorCache.set(levelId, newFloor);
                summary.floorsCreated++;
              }
              
            } catch (err) {
              summary.warnings.push(`Floor error: ${err.message}`);
            }
          }
          
          console.log(`✅ Floors complete: ${summary.floorsCreated} created, ${summary.floorsUpdated} updated`);
        }
      } catch (err) {
        summary.warnings.push(`Floors file processing error: ${err.message}`);
        console.error('Floors error:', err);
      }
    }
    
    // ============================================
    // PROCESS ROOMS FILE
    // ============================================
    if (roomsFileId) {
      try {
        console.log('Fetching rooms file...');
        const roomsUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/${roomsFileId}`;
        const roomsResponse = await fetch(roomsUrl);
        
        if (!roomsResponse.ok) {
          summary.warnings.push(`Failed to fetch rooms file: ${roomsResponse.statusText}`);
        } else {
          // Detect file format - check if it's XLSX or TSV
          const arrayBuffer = await roomsResponse.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const isXLSX = bytes[0] === 0x50 && bytes[1] === 0x4B; // PK signature
          
          let roomsData = [];
          
          if (isXLSX) {
            console.log('Detected XLSX format for rooms file');
            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            roomsData = XLSX.utils.sheet_to_json(firstSheet);
            console.log(`Parsed ${roomsData.length} rooms from XLSX`);
          } else {
            console.log('Detected TSV/CSV format for rooms file');
            const text = new TextDecoder('utf-8').decode(bytes);
            console.log('Rooms file text length:', text.length);
            console.log('First 200 chars:', text.substring(0, 200));
            
            // Parse TSV text with BOM handling
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
            console.log('Total lines:', lines.length);
            
            // Extract headers and strip UTF-8 BOM
            let header = lines[0];
            console.log('Raw header (first 100 chars):', header.substring(0, 100));
            console.log('Header char codes:', Array.from(header.substring(0, 10)).map(c => c.charCodeAt(0)));
            
            header = header.replace(/^\uFEFF/, "");   // removes BOM
            console.log('Header after BOM removal:', header.substring(0, 100));
            
            const columns = header.split("\t").map(col => col.trim());
            console.log('Column count:', columns.length);
            console.log('First 5 columns:', columns.slice(0, 5));
            console.log('First column exact:', JSON.stringify(columns[0]));
            
            for (let i = 1; i < lines.length; i++) {
              const row = lines[i].split("\t");
              const obj = {};
              
              for (let c = 0; c < columns.length; c++) {
                obj[columns[c]] = row[c] ?? "";
              }
              
              // Debug first row
              if (i === 1) {
                console.log('First row object keys:', Object.keys(obj).slice(0, 5));
                console.log('First row _id value:', obj["_id"]);
              }
              
              // Validate
              if (!obj["_id"] || obj["_id"].trim() === "") {
                summary.warnings.push(`Room missing _id at row ${i}`);
                continue;
              }
              
              roomsData.push(obj);
            }
            
            console.log('Parsed room count:', roomsData.length);
            console.log('Room headers:', columns);
            }

            // Apply skip/limit
            const startIdx = skipRows;
            const endIdx = limitRows ? Math.min(startIdx + limitRows, roomsData.length) : roomsData.length;
            console.log(`Processing rooms ${startIdx} to ${endIdx} of ${roomsData.length}`);

            for (let i = startIdx; i < endIdx; i++) {
            const row = roomsData[i];
            
            // Add delay to avoid rate limits (500ms per room)
            if (i > startIdx) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (i % 100 === 0 && i > 0) {
              console.log(`Processing room ${i} of ${roomsData.length}`);
            }
            
            try {
              const roomId = row['_id'];
              const number = row['Number'] || '';
              const name = row['Name'] || '';
              const category = row['Room Category'] || '';
              const floorName = row['Floor'] || '';
              const buildingName = row['Building'] || '';
              const squareFeet = row['Square Feet'];
              const type = row['Type'] || '';
              const floorType = row['Floor Type'] || '';
              const verified = row['Verified'] === 'Verified';
              const description = row['Description'] || '';
              const occupant = row['Occupant'] || '';
              const status = row['Status'] || 'Active';
              const decommissionedDate = row['Decommissioned Date'] || null;
              const url = row['Url'] || '';
              const portalUrl = row['Portal URL'] || '';
              
              if (!roomId) {
                summary.warnings.push(`Room missing _id at row ${i + 1}`);
                continue;
              }
              
              // Find or create Building
              let building = buildingCache.get(buildingName);
              if (!building && buildingName) {
                const existing = await base44.asServiceRole.entities.Building.filter({ name: buildingName });
                if (existing.length > 0) {
                  building = existing[0];
                } else {
                  building = await base44.asServiceRole.entities.Building.create({
                    name: buildingName,
                    akita_building_id: '',
                    address: null,
                    notes: null
                  });
                  summary.buildingsCreated++;
                }
                buildingCache.set(buildingName, building);
              }
              
              // Find Floor
              let floor = null;
              if (building && floorName) {
                const floors = await base44.asServiceRole.entities.Floor.filter({
                  building_id: building.id,
                  name: floorName
                });
                if (floors.length > 0) {
                  floor = floors[0];
                } else {
                  summary.warnings.push(`Room ${roomId}: Floor "${floorName}" not found in building "${buildingName}"`);
                }
              }
              
              // Upsert Room
              const existing = await base44.asServiceRole.entities.Room.filter({ akita_room_id: roomId });
              const roomData = {
                akita_room_id: roomId,
                room_number: number,
                room_name: name,
                room_category: category,
                floor_id: floor?.id || null,
                floor_name: floorName,
                building_id: building?.id || null,
                building_name: buildingName,
                square_feet: squareFeet ? String(squareFeet) : '',
                type: type,
                floor_type: floorType,
                verified: verified,
                description: description,
                occupant: occupant,
                status: status,
                decommissioned_date: decommissionedDate,
                akita_url: url,
                portal_url: portalUrl,
                updated_at: new Date().toISOString(),
                updated_by: user.email
              };
              
              if (existing.length > 0) {
                await base44.asServiceRole.entities.Room.update(existing[0].id, roomData);
                roomCache.set(roomId, existing[0]);
                summary.roomsUpdated++;
              } else {
                roomData.created_at = new Date().toISOString();
                roomData.created_by = user.email;
                const newRoom = await base44.asServiceRole.entities.Room.create(roomData);
                roomCache.set(roomId, newRoom);
                summary.roomsCreated++;
              }
              
            } catch (err) {
              summary.warnings.push(`Room error at row ${i + 1}: ${err.message}`);
            }
          }
          
          console.log(`✅ Rooms complete: ${summary.roomsCreated} created, ${summary.roomsUpdated} updated`);
        }
      } catch (err) {
        summary.warnings.push(`Rooms file processing error: ${err.message}`);
        console.error('Rooms error:', err);
      }
    }
    
    // ============================================
    // PROCESS ASSETS FILE
    // ============================================
    if (assetsFileId) {
      try {
        console.log('Fetching assets file...');
        const assetsUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/${assetsFileId}`;
        const assetsResponse = await fetch(assetsUrl);
        
        if (!assetsResponse.ok) {
          summary.warnings.push(`Failed to fetch assets file: ${assetsResponse.statusText}`);
        } else {
          const text = await assetsResponse.text();
          const assetsData = parseTSV(text);
          
          console.log(`Parsed ${assetsData.length} assets`);
          
          for (let i = 0; i < assetsData.length; i++) {
            const row = assetsData[i];
            
            if (i % 100 === 0 && i > 0) {
              console.log(`Processing asset ${i} of ${assetsData.length}`);
            }
            
            try {
              const assetId = row['_id'];
              const assetName = row['Name'] || 'Unnamed Asset';
              const assetCategory = row['Asset Category'] || '';
              const buildingName = row['Building'] || '';
              const floorName = row['Floor'] || '';
              const roomNumber = row['Room Number'] || '';
              const manufacturer = row['Manufacturer'] || '';
              const model = row['Model'] || '';
              const serialNumber = row['Serial Number'] || '';
              const condition = row['Condition'] || '';
              const conditionDate = row['Condition Date'] || null;
              const assetType = row['Type'] || '';
              const xCoord = row['X Coordinate'];
              const yCoord = row['Y Coordinate'];
              const status = row['Status'] || 'Active';
              const url = row['Url'] || '';
              
              if (!assetId) {
                summary.warnings.push(`Asset missing _id at row ${i + 1}`);
                continue;
              }
              
              // Find or create AssetGroup
              let assetGroup = null;
              if (assetCategory) {
                assetGroup = assetGroupCache.get(assetCategory);
                if (!assetGroup) {
                  const existing = await base44.asServiceRole.entities.AssetGroup.filter({ name: assetCategory });
                  if (existing.length > 0) {
                    assetGroup = existing[0];
                  } else {
                    assetGroup = await base44.asServiceRole.entities.AssetGroup.create({
                      name: assetCategory,
                      description: `Asset category: ${assetCategory}`
                    });
                    summary.assetGroupsCreated = (summary.assetGroupsCreated || 0) + 1;
                  }
                  assetGroupCache.set(assetCategory, assetGroup);
                }
              }
              
              // Find Building
              let building = buildingCache.get(buildingName);
              if (!building && buildingName) {
                const existing = await base44.asServiceRole.entities.Building.filter({ name: buildingName });
                if (existing.length > 0) {
                  building = existing[0];
                  buildingCache.set(buildingName, building);
                } else {
                  summary.warnings.push(`Asset ${assetId}: Building "${buildingName}" not found`);
                }
              }
              
              // Find Floor
              let floor = null;
              if (building && floorName) {
                const floors = await base44.asServiceRole.entities.Floor.filter({
                  building_id: building.id,
                  name: floorName
                });
                if (floors.length > 0) {
                  floor = floors[0];
                }
              }
              
              // Find Room
              let room = null;
              if (building && roomNumber) {
                const rooms = await base44.asServiceRole.entities.Room.filter({
                  building_id: building.id,
                  room_number: roomNumber
                });
                if (rooms.length > 0) {
                  room = rooms[0];
                }
              }
              
              // Parse coordinates
              let xCoordNum = null;
              let yCoordNum = null;
              if (xCoord) {
                xCoordNum = parseFloat(xCoord);
                if (isNaN(xCoordNum) || xCoordNum < 0 || xCoordNum > 1) {
                  summary.warnings.push(`Asset ${assetId}: Invalid X coordinate ${xCoord}`);
                  xCoordNum = null;
                }
              }
              if (yCoord) {
                yCoordNum = parseFloat(yCoord);
                if (isNaN(yCoordNum) || yCoordNum < 0 || yCoordNum > 1) {
                  summary.warnings.push(`Asset ${assetId}: Invalid Y coordinate ${yCoord}`);
                  yCoordNum = null;
                }
              }
              
              // Upsert Asset
              const existing = await base44.asServiceRole.entities.Asset.filter({ akita_asset_id: assetId });
              const assetData = {
                akita_asset_id: assetId,
                name: assetName,
                asset_category: assetCategory,
                asset_group_id: assetGroup?.id || null,
                building_id: building?.id || null,
                building_name: buildingName,
                floor_id: floor?.id || null,
                floor_name: floorName,
                room_id: room?.id || null,
                room_number: roomNumber,
                manufacturer: manufacturer,
                model: model,
                serial_number: serialNumber,
                condition: condition,
                condition_date: conditionDate,
                type: assetType,
                x_coord: xCoordNum,
                y_coord: yCoordNum,
                status: status,
                akita_url: url,
                updated_at: new Date().toISOString(),
                updated_by: user.email
              };
              
              if (existing.length > 0) {
                await base44.asServiceRole.entities.Asset.update(existing[0].id, assetData);
                summary.assetsUpdated++;
              } else {
                assetData.created_at = new Date().toISOString();
                assetData.created_by = user.email;
                await base44.asServiceRole.entities.Asset.create(assetData);
                summary.assetsCreated++;
              }
              
            } catch (err) {
              summary.warnings.push(`Asset error at row ${i + 1}: ${err.message}`);
            }
          }
          
          console.log(`✅ Assets complete: ${summary.assetsCreated} created, ${summary.assetsUpdated} updated`);
        }
      } catch (err) {
        summary.warnings.push(`Assets file processing error: ${err.message}`);
        console.error('Assets error:', err);
      }
    }
    
    console.log('✅ Import complete!');
    console.log(`Summary: ${JSON.stringify(summary, null, 2)}`);
    
    return Response.json({
      success: true,
      summary
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack || error.toString()
    }, { status: 500 });
  }
});