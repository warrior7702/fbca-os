import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.clickup_access_token) {
      return Response.json({ error: 'ClickUp not connected' }, { status: 400 });
    }

    const { listId } = await req.json();

    if (!listId) {
      return Response.json({ error: 'List ID is required' }, { status: 400 });
    }

    // Get tasks from specific list
    const tasksResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=false&subtasks=true`,
      {
        headers: { 'Authorization': user.clickup_access_token }
      }
    );

    if (!tasksResponse.ok) {
      return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    const tasksData = await tasksResponse.json();
    const tasks = (tasksData.tasks || []).map(task => ({
      id: task.id,
      name: task.name,
      description: task.description || task.text_content,
      status: task.status?.status,
      priority: task.priority?.id,
      priorityName: task.priority?.priority,
      due_date: task.due_date ? parseInt(task.due_date) : null,
      assignees: task.assignees?.map(a => a.username) || []
    }));

    return Response.json({ tasks });

  } catch (error) {
    console.error('Get ClickUp tasks error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});