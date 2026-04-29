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

    let type, buildingId, levelId;
    
    try {
      const body = await req.json();
      console.log('📦 Raw request body:', JSON.stringify(body, null, 2));
      type = body.type;
      buildingId = body.buildingId;
      levelId = body.levelId;
      console.log('📥 Parsed params:', { type, buildingId, levelId });
    } catch (e) {
      console.error('❌ Failed to parse request body:', e);
      return Response.json({ 
        success: false,
        error: 'Invalid request body',
        details: e.message 
      }, { status: 400 });
    }
    
    if (!type) {
      console.error('❌ No type provided in request');
      return Response.json({ 
        success: false,
        error: 'Missing required parameter: type',
        details: 'Request must include a "type" field (buildings, levels, rooms, or assets)'
      }, { status: 400 });
    }
    
    // Prioritize AKITA_COOKIE since it's already set
    const cookie = Deno.env.get('AKITA_COOKIE');
    const jwt = Deno.env.get('AKITABOX_JWT');

    if (!cookie && !jwt) {
      console.error('No AkitaBox credentials found');
      return Response.json({ 
        success: false,
        error: 'AkitaBox credentials not configured',
        details: 'Please add AKITA_COOKIE or AKITABOX_JWT secret in Settings'
      }, { status: 500 });
    }

    // Use cookie directly if available (full cookie string), otherwise use JWT format
    const cookieValue = cookie || `abx_jwt=${jwt}`;
    console.log('🔑 Using auth, type:', cookie ? 'AKITA_COOKIE' : 'JWT', 'length:', cookieValue.length);

    const headers = {
      'Cookie': cookieValue,
      'Accept': 'application/json',
      'Origin': 'https://fbca.akitabox.com'
    };

    let url, data;

    switch (type) {
      case 'buildings':
        url = `${AKITABOX_API}/organizations/${ORG_ID}/buildings?insensitive=true&limit=1000&skip=0&sort=name,%20asc`;
        console.log('Fetching buildings from:', url);
        
        const buildingsResponse = await fetch(url, { headers });
        console.log('🏢 Buildings response status:', buildingsResponse.status);
        console.log('🏢 Response headers:', Object.fromEntries(buildingsResponse.headers));
        
        if (!buildingsResponse.ok) {
          const errorText = await buildingsResponse.text();
          console.error('❌ Buildings API Error:', buildingsResponse.status, errorText);
          
          if (buildingsResponse.status === 401) {
            return Response.json({ 
              success: false,
              error: 'AkitaBox cookie expired',
              details: 'Your AkitaBox authentication cookie has expired. To fix:\n\n1. Log into https://fbca.akitabox.com in your browser\n2. Open Developer Tools (F12)\n3. Go to Application > Cookies\n4. Copy the "abx_jwt" cookie value\n5. Update the AKITA_COOKIE secret in Settings\n\nAlternatively, just paste the JWT token value into AKITABOX_JWT secret.',
              statusCode: 401
            }, { status: 500 });
          }
          
          return Response.json({ 
            success: false,
            error: `AkitaBox API returned ${buildingsResponse.status}`,
            details: errorText,
            statusCode: buildingsResponse.status
          }, { status: 500 });
        }
        
        const buildingsData = await buildingsResponse.json();
        let buildings = Array.isArray(buildingsData) ? buildingsData : (buildingsData.data || buildingsData.results || []);
        
        buildings = buildings.map(building => ({
          id: building._id || building.id,
          name: building.name,
          address: building.address,
          levels: building.levels || []
        }));
        
        console.log('Buildings extracted:', buildings.length);
        console.log('Sample building with levels:', JSON.stringify(buildings[0], null, 2));
        data = { buildings };
        break;

      case 'levels':
        if (!buildingId) {
          return Response.json({ error: 'buildingId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/levels?limit=1000&skip=0`;
        console.log('Fetching levels from:', url);
        
        const levelsResponse = await fetch(url, { headers });
        console.log('Levels response status:', levelsResponse.status);
        
        if (!levelsResponse.ok) {
          const errorText = await levelsResponse.text();
          console.error('Levels API Error:', errorText);
          return Response.json({ 
            error: `AkitaBox API error: ${levelsResponse.status}`,
            details: errorText
          }, { status: 500 });
        }
        
        const levelsData = await levelsResponse.json();
        const levels = Array.isArray(levelsData) ? levelsData : (levelsData.data || levelsData.results || []);
        console.log('Levels extracted:', levels.length);
        data = { levels };
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