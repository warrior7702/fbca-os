import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.pco_access_token || !user.clickup_access_token) {
            return Response.json({ 
                error: 'PCO or ClickUp not connected' 
            }, { status: 400 });
        }

        const { 
            request_id,
            approval,
            form_data
        } = await req.json();

        // 1. Approve in PCO
        const pcoResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        type: 'EventResourceRequest',
                        id: request_id,
                        attributes: {
                            approval_status: 'A'
                        }
                    }
                })
            }
        );

        if (!pcoResponse.ok) {
            throw new Error('Failed to approve in PCO');
        }

        // 2. Create ClickUp task
        const listId = Deno.env.get('CLICKUP_SPECIAL_EVENT_MASTER_LIST_ID') || '901606358969';
        
        // Build task description
        const description = `
**Event:** ${approval.event_name}
**Date:** ${approval.event_starts_at ? new Date(approval.event_starts_at).toLocaleDateString() : 'N/A'}
**Resource:** ${approval.resource_name}
**Approval Group:** ${approval.approval_group_name}

**Access Details:**
- Type: ${form_data.access_type}
- Entrance: ${form_data.entrance}
- Badge/Code: ${form_data.badge_code || 'N/A'}
- Time: ${form_data.start_time} - ${form_data.end_time}
- Buildings: ${form_data.buildings.join(', ') || 'N/A'}
- Doors: ${form_data.doors || 'N/A'}

**Notes:** ${form_data.notes || 'N/A'}

**PCO Request ID:** ${request_id}
        `.trim();

        // Get custom field IDs from env or use defaults
        const customFields = [
            {
                id: 'e3e1ee9a-fec5-4437-bbb5-bd59364b5587', // CODE
                value: form_data.badge_code || ''
            },
            {
                id: 'c646ced5-d49e-4c2e-9b0e-117f197f86ea', // Doors
                value: form_data.doors || ''
            },
            {
                id: '7e7622b9-af32-4f7e-8001-6209ed813835', // Note Info
                value: form_data.notes || ''
            }
        ];

        // Add buildings if provided
        if (form_data.buildings.length > 0) {
            customFields.push({
                id: '882b4a4f-4e8d-4ae2-9a11-c7c4f2a0845a', // Building(s) labels
                value: form_data.buildings
            });
        }

        // Add personnel if provided
        if (form_data.personnel) {
            customFields.push({
                id: '5ce567c7-da49-4095-902e-3761de159723', // Personnel
                value: form_data.personnel
            });
        }

        const clickupPayload = {
            name: `Building Access: ${approval.event_name}`,
            description: description,
            status: 'Open',
            priority: 3,
            due_date: approval.event_starts_at ? new Date(approval.event_starts_at).getTime() : null,
            custom_fields: customFields.filter(f => f.value)
        };

        const clickupResponse = await fetch(
            `https://api.clickup.com/api/v2/list/${listId}/task`,
            {
                method: 'POST',
                headers: {
                    'Authorization': user.clickup_access_token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clickupPayload)
            }
        );

        if (!clickupResponse.ok) {
            const errorText = await clickupResponse.text();
            console.error('ClickUp error:', errorText);
            throw new Error('Failed to create ClickUp task');
        }

        const clickupData = await clickupResponse.json();

        return Response.json({ 
            success: true,
            pco_approved: true,
            clickup_task_id: clickupData.id,
            clickup_task_url: clickupData.url
        });

    } catch (error) {
        console.error('Approve with task error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});