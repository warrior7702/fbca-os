import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, displayName, description, template } = await req.json();

    if (!siteId || !displayName) {
      return Response.json({ 
        error: 'siteId and displayName are required' 
      }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);

    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Create the list
    const createResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
      {
        method: 'POST',
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName,
          description: description || '',
          list: {
            template: template || 'genericList'
          }
        })
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Create list error:', createResponse.status, errorText);
      return Response.json({ 
        success: false, 
        error: `Failed to create list: ${errorText.substring(0, 200)}` 
      }, { status: 500 });
    }

    const newList = await createResponse.json();

    return Response.json({
      success: true,
      list: newList
    });

  } catch (error) {
    console.error('Error creating SharePoint list:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});