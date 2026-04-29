import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);

    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Get recent files across all drives
    const recentResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/drive/recent',
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!recentResponse.ok) {
      const errorText = await recentResponse.text();
      return Response.json({ 
        success: false, 
        error: `Failed to fetch recent files: ${errorText}` 
      }, { status: 500 });
    }

    const recentData = await recentResponse.json();

    return Response.json({
      success: true,
      files: recentData.value || []
    });

  } catch (error) {
    console.error('Error fetching recent files:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});