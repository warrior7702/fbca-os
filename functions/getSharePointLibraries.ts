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
      return Response.json({ error: 'siteId required' }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Get document libraries for the site
    const librariesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
      {
        headers: {
          'Authorization': `Bearer ${ssoToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!librariesResponse.ok) {
      throw new Error(`SharePoint API error: ${librariesResponse.status}`);
    }

    const librariesData = await librariesResponse.json();

    return Response.json({
      success: true,
      libraries: librariesData.value || []
    });

  } catch (error) {
    console.error('Error fetching SharePoint libraries:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});