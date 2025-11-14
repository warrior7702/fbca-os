import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!accessToken) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    const { siteId, listId, itemId, completed } = await req.json();

    if (!siteId || !listId || !itemId) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const updateData = {
      fields: {
        Status: completed ? 'Completed' : 'In Progress',
        PercentComplete: completed ? 1 : 0
      }
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Update error:', errorText);
      return Response.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('Update Microsoft List item error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});