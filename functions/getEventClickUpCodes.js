import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.clickup_access_token) {
            return Response.json({ door_codes: {} });
        }

        const { event_names } = await req.json();

        if (!event_names || event_names.length === 0) {
            return Response.json({ door_codes: {} });
        }

        console.log('🔍 Searching ClickUp for event codes:', event_names.length, 'events');

        // Search ClickUp for tasks related to these events
        const listId = '901606358969'; // Special Event Master list
        const doorCodes = {};

        try {
            // Get all tasks from the Special Event Master list
            const tasksResponse = await fetch(
                `https://api.clickup.com/api/v2/list/${listId}/task?archived=false&include_closed=false`,
                {
                    headers: {
                        'Authorization': user.clickup_access_token,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!tasksResponse.ok) {
                console.error('ClickUp API error:', await tasksResponse.text());
                return Response.json({ door_codes: {} });
            }

            const tasksData = await tasksResponse.json();
            const tasks = tasksData.tasks || [];

            console.log('📋 Found', tasks.length, 'tasks in ClickUp');

            // Look for tasks that match event names and have door codes
            for (const task of tasks) {
                const taskName = task.name?.toLowerCase() || '';
                
                // Check if this task is related to any of our events
                for (const eventName of event_names) {
                    const eventNameLower = eventName.toLowerCase();
                    
                    if (taskName.includes(eventNameLower) || 
                        taskName.includes('building access') && task.description?.toLowerCase().includes(eventNameLower)) {
                        
                        // Extract door code from custom fields
                        const customFields = task.custom_fields || [];
                        const codeField = customFields.find(f => 
                            f.id === 'e3e1ee9a-fec5-4437-bbb5-bd59364b5587' && f.value
                        );

                        if (codeField && codeField.value) {
                            doorCodes[eventName] = {
                                code: codeField.value,
                                task_id: task.id,
                                task_url: task.url,
                                task_name: task.name
                            };
                            console.log('✅ Found code for', eventName, ':', codeField.value);
                        }
                    }
                }
            }

            console.log('🎯 Final door codes found:', Object.keys(doorCodes).length);

            return Response.json({ door_codes: doorCodes });

        } catch (error) {
            console.error('Error searching ClickUp:', error);
            return Response.json({ door_codes: {} });
        }

    } catch (error) {
        console.error('Get event ClickUp codes error:', error);
        return Response.json({ error: error.message, door_codes: {} }, { status: 500 });
    }
});