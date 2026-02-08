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

    if (!currentUser?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    const accessToken = await refreshTokenIfNeeded(base44, user);

    // Fetch ALL resources (no filter)
    console.log('Fetching ALL resources from PCO...');
    let allResources = [];
    let nextUrl = 'https://api.planningcenteronline.com/calendar/v2/resources?per_page=100';

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.status}`);
      }

      const data = await response.json();
      allResources = allResources.concat(data.data || []);
      
      // Check for next page
      nextUrl = data.links?.next || null;
      console.log(`Fetched ${data.data?.length} resources, total so far: ${allResources.length}`);
    }

    console.log('Total resources fetched:', allResources.length);

    // Categorize by kind and resource_type
    const byKind = {};
    const byResourceType = {};
    const byFolder = {};

    for (const resource of allResources) {
      const kind = resource.attributes?.kind || 'unknown';
      const resourceType = resource.attributes?.resource_type || 'unknown';
      const pathParts = resource.attributes?.path_parts || [];
      const folder = pathParts[0] || 'No Folder';

      byKind[kind] = (byKind[kind] || 0) + 1;
      byResourceType[resourceType] = (byResourceType[resourceType] || 0) + 1;
      byFolder[folder] = (byFolder[folder] || 0) + 1;
    }

    // Get sample of each kind
    const samples = {};
    for (const kind of Object.keys(byKind)) {
      samples[kind] = allResources
        .filter(r => (r.attributes?.kind || 'unknown') === kind)
        .slice(0, 3)
        .map(r => ({
          id: r.id,
          name: r.attributes?.name,
          kind: r.attributes?.kind,
          resource_type: r.attributes?.resource_type,
          path: r.attributes?.path_parts?.join(' > ')
        }));
    }

    return Response.json({
      success: true,
      summary: {
        total_resources: allResources.length,
        by_kind: byKind,
        by_resource_type: byResourceType,
        by_folder: byFolder
      },
      samples
    });

  } catch (error) {
    console.error('Error in getAllPCOResources:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});