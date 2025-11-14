import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AKITABOX_API = 'https://api.akitabox.com';
const ORG_ID = '60ad1f92eae3d10661be97fb';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('User not authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, buildingId, levelId } = await req.json();
    console.log('Request:', { type, buildingId, levelId });
    
    const jwt = Deno.env.get('AKITABOX_JWT');

    if (!jwt) {
      console.error('AKITABOX_JWT not found in environment');
      return Response.json({ error: 'AkitaBox JWT not configured' }, { status: 500 });
    }

    console.log('JWT found, length:', jwt.length);

    const headers = {
      'Cookie': `abx_jwt=${jwt}`,
      'Accept': 'application/json',
      'Origin': 'https://fbca.akitabox.com'
    };

    let url, data;

    switch (type) {
      case 'buildings':
        url = `${AKITABOX_API}/organizations/${ORG_ID}/building_groups?insensitive=true&limit=1000&skip=0&sort=name,%20asc`;
        console.log('Fetching building groups from:', url);
        
        const groupsResponse = await fetch(url, { headers });
        console.log('Response status:', groupsResponse.status);
        
        if (!groupsResponse.ok) {
          const errorText = await groupsResponse.text();
          console.error('API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${groupsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        const groups = await groupsResponse.json();
        console.log('Groups fetched:', groups.length);
        
        const buildings = [];
        const buildingIds = new Set();
        
        groups.forEach(group => {
          if (group.buildings) {
            group.buildings.forEach(building => {
              if (!buildingIds.has(building._id)) {
                buildingIds.add(building._id);
                buildings.push({
                  id: building._id,
                  name: building.name,
                  address: building.address,
                  levels: building.levels || []
                });
              }
            });
          }
        });
        
        console.log('Buildings extracted:', buildings.length);
        data = { buildings };
        break;

      case 'rooms':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/rooms?count=true&level=${levelId}&limit=1000&skip=0`;
        console.log('Fetching rooms from:', url);
        
        const roomsResponse = await fetch(url, { headers });
        if (!roomsResponse.ok) {
          const errorText = await roomsResponse.text();
          console.error('Rooms API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${roomsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        data = await roomsResponse.json();
        console.log('Rooms fetched:', data.length || 0);
        break;

      case 'assets':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/assets?count=true&include_values=false&level=${levelId}&limit=1000&skip=0`;
        console.log('Fetching assets from:', url);
        
        const assetsResponse = await fetch(url, { headers });
        if (!assetsResponse.ok) {
          const errorText = await assetsResponse.text();
          console.error('Assets API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${assetsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        data = await assetsResponse.json();
        console.log('Assets fetched:', data.length || 0);
        break;

      case 'building_details':
        if (!buildingId) {
          return Response.json({ error: 'buildingId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}`;
        console.log('Fetching building details from:', url);
        
        const buildingResponse = await fetch(url, { headers });
        if (!buildingResponse.ok) {
          const errorText = await buildingResponse.text();
          console.error('Building details API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${buildingResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        data = await buildingResponse.json();
        break;

      default:
        return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    return Response.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('AkitaBox function error:', error);
    console.error('Stack:', error.stack);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});