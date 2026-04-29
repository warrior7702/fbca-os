import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ssoAuthorization = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!ssoAuthorization) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    const { searchQuery } = await req.json().catch(() => ({}));

    let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle&$top=999';
    
    if (searchQuery) {
      url += `&$filter=startsWith(displayName,'${searchQuery}') or startsWith(mail,'${searchQuery}')`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': ssoAuthorization,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Microsoft Graph API error:', errorText);
      return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const data = await response.json();
    
    return Response.json({
      success: true,
      users: data.value || []
    });

  } catch (error) {
    console.error('Get Microsoft users error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});