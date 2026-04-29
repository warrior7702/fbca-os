import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, driveId, fileName, fileUrl, folderId } = await req.json();
    
    if (!siteId || !driveId || !fileName || !fileUrl) {
      return Response.json({ 
        error: 'siteId, driveId, fileName, and fileUrl required' 
      }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Download file from URL
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }
    const fileBlob = await fileResponse.blob();

    // Upload to SharePoint
    const uploadEndpoint = folderId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folderId}:/${fileName}:/content`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`;

    const uploadResponse = await fetch(uploadEndpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ssoToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: fileBlob
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();

    return Response.json({
      success: true,
      file: uploadData
    });

  } catch (error) {
    console.error('Error uploading to SharePoint:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});