import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await req.json();

    if (!messageId) {
      return Response.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Try SSO token first, then fall back to stored token
    let accessToken = null;
    try {
      accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    } catch (e) {
      console.log('SSO token not available, using stored token');
    }
    
    if (!accessToken && user.microsoft_access_token) {
      accessToken = user.microsoft_access_token;
    }
    
    if (!accessToken) {
      return Response.json({ error: 'Microsoft not connected' }, { status: 401 });
    }

    // Remove flag from email (clear the flag)
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flag: {
            flagStatus: 'notFlagged'
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Remove flag failed:', response.status, errorData);
      return Response.json({ 
        error: 'Failed to remove flag',
        details: errorData.error?.message || response.statusText
      }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({ success: true, message: result });

  } catch (error) {
    console.error('Remove flag error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});