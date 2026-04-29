import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Attempting to get SSO token for user:', user.id, user.email);
    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    console.log('SSO Token retrieved:', !!ssoToken);
    console.log('Token length:', ssoToken?.length || 0);

    if (!ssoToken) {
      console.error('No SSO token available for user:', user.email);
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected. Please connect Microsoft in Settings.' 
      }, { status: 403 });
    }

    // Get sites the user follows/has access to
    console.log('Calling Microsoft Graph API for SharePoint sites...');
    const sitesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/followedSites',
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('SharePoint API response status:', sitesResponse.status);

    if (!sitesResponse.ok) {
      const errorText = await sitesResponse.text();
      console.error('SharePoint API error details:', {
        status: sitesResponse.status,
        statusText: sitesResponse.statusText,
        error: errorText
      });

      return Response.json({ 
        success: false, 
        error: `SharePoint API error (${sitesResponse.status}): ${errorText.substring(0, 200)}` 
      }, { status: 500 });
    }

    const sitesData = await sitesResponse.json();
    console.log('SharePoint sites found:', sitesData.value?.length || 0);

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