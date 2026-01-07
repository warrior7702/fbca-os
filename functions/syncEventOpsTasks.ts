import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Define target approval groups and their task types
    const APPROVAL_GROUP_MAPPING = {
      'Approval Group Room Setups': 'room_setup',
      'Approval Group Maintenance': 'maintenance'
    };

    // Fetch all PCO requests
    const allRequests = await base44.asServiceRole.entities.PCO_Request.list();
    
    // Filter for target approval groups
    const targetRequests = allRequests.filter(request => 
      request.approval_group_name && 
      Object.keys(APPROVAL_GROUP_MAPPING).includes(request.approval_group_name)
    );

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const request of targetRequests) {
      try {
        // Determine task type from approval group
        const taskType = APPROVAL_GROUP_MAPPING[request.approval_group_name];
        
        // Fetch the related PCO Event
        const events = await base44.asServiceRole.entities.PCO_Event.filter({
          pco_event_id: request.pco_event_id
        });
        
        if (events.length === 0) {
          results.errors.push(`No event found for request ${request.pco_request_id}`);
          results.skipped++;
          continue;
        }

        const event = events[0];

        // Generate checklist from answers payload
        const checklist = generateChecklistFromAnswers(request.answers);

        // Determine task status
        // Only mark todo if pending/approved - never auto-complete
        let taskStatus = 'todo';
        if (request.status === 'denied') {
          results.skipped++;
          continue; // Skip denied requests
        }

        // Check if task already exists
        const existingTasks = await base44.asServiceRole.entities.Ops_Task.filter({
          pco_request_id: request.pco_request_id
        });

        const taskData = {
          event_id: request.pco_event_id,
          pco_event_instance_id: request.pco_event_instance_id,
          pco_request_id: request.pco_request_id,
          department: taskType === 'room_setup' ? 'Facilities' : 'Facilities',
          task_type: taskType,
          title: `${request.resource_name} - ${event.title}`,
          summary: request.notes || `${request.resource_name} for ${event.title}`,
          status: taskStatus,
          due_at: event.starts_at, // Due at event start
          start_window_at: null,
          checklist: checklist,
          created_from: 'pco_auto',
          priority: 'med'
        };

        if (existingTasks.length > 0) {
          // Update existing task (but preserve status if manually changed)
          const existingTask = existingTasks[0];
          
          // Only update if not manually completed
          if (existingTask.status !== 'done' && existingTask.status !== 'blocked') {
            await base44.asServiceRole.entities.Ops_Task.update(existingTask.id, {
              title: taskData.title,
              summary: taskData.summary,
              checklist: taskData.checklist,
              due_at: taskData.due_at
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new task
          await base44.asServiceRole.entities.Ops_Task.create(taskData);
          results.created++;
        }

        results.processed++;
      } catch (error) {
        results.errors.push(`Error processing request ${request.pco_request_id}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error syncing EventOps tasks:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

/**
 * Generate checklist items from PCO request answers payload
 */
function generateChecklistFromAnswers(answers) {
  if (!answers || typeof answers !== 'object') {
    return [];
  }

  const checklist = [];

  // Handle different answer payload structures
  if (Array.isArray(answers)) {
    // If answers is an array of Q&A objects
    for (const item of answers) {
      if (item.question && item.answer) {
        checklist.push({
          label: item.question,
          value: item.answer,
          done: false
        });
      }
    }
  } else if (typeof answers === 'object') {
    // If answers is an object with question keys
    for (const [question, answer] of Object.entries(answers)) {
      if (answer !== null && answer !== undefined && answer !== '') {
        // Handle different answer types
        let displayValue = answer;
        
        if (typeof answer === 'object') {
          displayValue = JSON.stringify(answer);
        } else if (typeof answer === 'boolean') {
          displayValue = answer ? 'Yes' : 'No';
        }

        checklist.push({
          label: question,
          value: displayValue.toString(),
          done: false
        });
      }
    }
  }

  return checklist;
}