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

    const headers = {
      'Cookie': `abx_jwt=${jwt}`,
      'Accept': 'application/json',
      'Origin': 'https://fbca.akitabox.com'
    };

    let url, data;

    switch (type) {
      case 'buildings':
        // Try direct buildings endpoint first
        url = `${AKITABOX_API}/organizations/${ORG_ID}/buildings?insensitive=true&limit=1000&skip=0&sort=name,%20asc`;
        console.log('Fetching buildings directly from:', url);
        
        const buildingsResponse = await fetch(url, { headers });
        console.log('Buildings response status:', buildingsResponse.status);
        
        if (!buildingsResponse.ok) {
          const errorText = await buildingsResponse.text();
          console.error('Buildings API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${buildingsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        const buildingsData = await buildingsResponse.json();
        console.log('Raw buildings response:', JSON.stringify(buildingsData, null, 2));
        
        // Handle both array and object with data property
        let buildings = Array.isArray(buildingsData) ? buildingsData : (buildingsData.data || buildingsData.results || []);
        
        // Map to consistent format
        buildings = buildings.map(building => ({
          id: building._id || building.id,
          name: building.name,
          address: building.address,
          levels: building.levels || []
        }));
        
        console.log('Buildings extracted:', buildings.length);
        console.log('Buildings:', buildings.map(b => b.name));
        data = { buildings };
        break;

      case 'rooms':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/rooms?count=true&level=${levelId}&limit=1000&skip=0`;
        console.log('Fetching rooms from:', url);
        
        const roomsResponse = await fetch(url, { headers });
        console.log('Rooms response status:', roomsResponse.status);
        
        if (!roomsResponse.ok) {
          const errorText = await roomsResponse.text();
          console.error('Rooms API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${roomsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        const roomsData = await roomsResponse.json();
        console.log('Raw rooms response type:', typeof roomsData);
        console.log('Rooms count:', Array.isArray(roomsData) ? roomsData.length : 'not array');
        
        const rooms = Array.isArray(roomsData) ? roomsData : (roomsData.data || roomsData.results || []);
        console.log('Rooms extracted:', rooms.length);
        data = { rooms };
        break;

      case 'assets':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/assets?count=true&include_values=false&level=${levelId}&limit=1000&skip=0`;
        console.log('Fetching assets from:', url);
        
        const assetsResponse = await fetch(url, { headers });
        console.log('Assets response status:', assetsResponse.status);
        
        if (!assetsResponse.ok) {
          const errorText = await assetsResponse.text();
          console.error('Assets API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${assetsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        const assetsData = await assetsResponse.json();
        console.log('Raw assets response type:', typeof assetsData);
        console.log('Assets count:', Array.isArray(assetsData) ? assetsData.length : 'not array');
        
        const assets = Array.isArray(assetsData) ? assetsData : (assetsData.data || assetsData.results || []);
        console.log('Assets extracted:', assets.length);
        data = { assets };
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