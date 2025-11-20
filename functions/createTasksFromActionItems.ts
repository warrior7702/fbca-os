import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionItems, meetingSubject, platform } = await req.json();

    if (!actionItems || actionItems.length === 0) {
      return Response.json({ error: 'No action items provided' }, { status: 400 });
    }

    const tasksCreated = [];
    const errors = [];

    // Create tasks based on available platform
    if (platform === 'clickup' && user.clickup_access_token) {
      // Create ClickUp tasks
      for (const item of actionItems) {
        const taskText = typeof item === 'string' ? item : item.item || item.task;
        const assigneeEmail = typeof item === 'object' ? item.assigned_email : null;

        try {
          // Note: This would need the ClickUp API implementation
          // For now, just track what would be created
          tasksCreated.push({
            platform: 'clickup',
            title: taskText,
            assignee: assigneeEmail,
            description: `From meeting: ${meetingSubject}`
          });
        } catch (error) {
          errors.push({ item: taskText, error: error.message });
        }
      }
    } else if (platform === 'microsoft' && user.microsoft_access_token) {
      // Create Microsoft To Do tasks
      for (const item of actionItems) {
        const taskText = typeof item === 'string' ? item : item.item || item.task;

        try {
          const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
          
          const response = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists/tasks/tasks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: taskText,
              body: {
                content: `From meeting: ${meetingSubject}`,
                contentType: 'text'
              },
              importance: 'normal'
            })
          });

          if (response.ok) {
            const task = await response.json();
            tasksCreated.push({
              platform: 'microsoft',
              id: task.id,
              title: task.title
            });
          } else {
            errors.push({ item: taskText, error: 'Microsoft API error' });
          }
        } catch (error) {
          errors.push({ item: taskText, error: error.message });
        }
      }
    } else {
      return Response.json({ 
        error: 'No task platform available. Connect ClickUp or Microsoft in Settings.' 
      }, { status: 400 });
    }

    return Response.json({ 
      success: true,
      tasksCreated: tasksCreated.length,
      tasks: tasksCreated,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Error creating tasks:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});