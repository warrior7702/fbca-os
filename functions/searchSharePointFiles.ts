import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchQuery } = await req.json();

    if (!searchQuery) {
      return Response.json({ 
        success: false, 
        error: 'Search query is required' 
      }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);

    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Search across all SharePoint
    const searchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`,
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      return Response.json({ 
        success: false, 
        error: `Search failed: ${errorText}` 
      }, { status: 500 });
    }

    const searchData = await searchResponse.json();

    return Response.json({
      success: true,
      results: searchData.value || []
    });

  } catch (error) {
    console.error('Error searching SharePoint:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});