import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, driveId, folderId } = await req.json();
    
    if (!siteId || !driveId) {
      return Response.json({ error: 'siteId and driveId required' }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Get files from library or folder
    const endpoint = folderId 
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folderId}/children`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`;

    const filesResponse = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${ssoToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!filesResponse.ok) {
      throw new Error(`SharePoint API error: ${filesResponse.status}`);
    }

    const filesData = await filesResponse.json();

    return Response.json({
      success: true,
      files: filesData.value || []
    });

  } catch (error) {
    console.error('Error fetching SharePoint files:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});