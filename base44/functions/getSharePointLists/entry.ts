import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await req.json();

    if (!siteId) {
      return Response.json({ error: 'siteId is required' }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);

    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Get lists for the site
    const listsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$expand=columns`,
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!listsResponse.ok) {
      const errorText = await listsResponse.text();
      console.error('SharePoint Lists API error:', listsResponse.status, errorText);
      return Response.json({ 
        success: false, 
        error: `Failed to fetch lists: ${errorText.substring(0, 200)}` 
      }, { status: 500 });
    }

    const listsData = await listsResponse.json();

    return Response.json({
      success: true,
      lists: listsData.value || []
    });

  } catch (error) {
    console.error('Error fetching SharePoint lists:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});