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

    // Get access token from SSO
    const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!accessToken) {
      return Response.json({ error: 'Microsoft not connected' }, { status: 401 });
    }

    // Move email to Archive folder
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          destinationId: 'archive'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Archive email failed:', response.status, errorData);
      return Response.json({ 
        error: 'Failed to archive email',
        details: errorData.error?.message || response.statusText
      }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({ success: true, message: result });

  } catch (error) {
    console.error('Archive email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});