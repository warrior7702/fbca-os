import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    console.log('SSO Token retrieved:', !!ssoToken);
    
    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected. Please connect Microsoft in Settings.' 
      }, { status: 403 });
    }

    // Get all SharePoint sites
    const sitesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/sites?search=*',
      {
        headers: {
          'Authorization': `Bearer ${ssoToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!sitesResponse.ok) {
      const errorText = await sitesResponse.text();
      console.error('SharePoint API error:', sitesResponse.status, errorText);
      throw new Error(`SharePoint API error: ${sitesResponse.status} - ${errorText}`);
    }

    const sitesData = await sitesResponse.json();

    return Response.json({
      success: true,
      sites: sitesData.value || []
    });

  } catch (error) {
    console.error('Error fetching SharePoint sites:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});