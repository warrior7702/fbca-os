import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AKITABOX_API = 'https://api.akitabox.com';
const ORG_ID = '60ad1f92eae3d10661be97fb';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, buildingId, levelId } = await req.json();
    const jwt = Deno.env.get('AKITABOX_JWT');

    if (!jwt) {
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
        // Fetch building groups which contains all buildings
        url = `${AKITABOX_API}/organizations/${ORG_ID}/building_groups?insensitive=true&limit=1000&skip=0&sort=name,%20asc`;
        const groupsResponse = await fetch(url, { headers });
        const groups = await groupsResponse.json();
        
        // Extract unique buildings
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
        
        data = { buildings };
        break;

      case 'rooms':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/rooms?count=true&level=${levelId}&limit=1000&skip=0`;
        const roomsResponse = await fetch(url, { headers });
        data = await roomsResponse.json();
        break;

      case 'assets':
        if (!buildingId || !levelId) {
          return Response.json({ error: 'buildingId and levelId required' }, { status: 400 });
        }
        
        url = `${AKITABOX_API}/buildings/${buildingId}/assets?count=true&include_values=false&level=${levelId}&limit=1000&skip=0`;
        const assetsResponse = await fetch(url, { headers });
        data = await assetsResponse.json();
        break;

      case 'building_details':
        if (!buildingId) {
          return Response.json({ error: 'buildingId required' }, { status: 400 });
        }
        
        // Fetch building with levels
        url = `${AKITABOX_API}/buildings/${buildingId}`;
        const buildingResponse = await fetch(url, { headers });
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
    console.error('AkitaBox API error:', error);
    return Response.json({
      error: error.message,
      details: 'Failed to fetch from AkitaBox'
    }, { status: 500 });
  }
});