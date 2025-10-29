import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { request_id, resource_id, event_id } = await req.json();

        // Fetch resource questions
        const questionsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/resources/${resource_id}/resource_questions`,
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let questions = [];
        if (questionsResponse.ok) {
            const questionsData = await questionsResponse.json();
            questions = questionsData.data.map(q => ({
                id: q.id,
                question: q.attributes.question,
                description: q.attributes.description,
                kind: q.attributes.kind,
                choices: q.attributes.choices,
                multiple_select: q.attributes.multiple_select,
                optional: q.attributes.optional
            }));
        }

        // Fetch answers for this specific request
        const answersResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/resource_answers`,
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const answers = {};
        if (answersResponse.ok) {
            const answersData = await answersResponse.json();
            answersData.data.forEach(answer => {
                const questionId = answer.relationships?.resource_question?.data?.id;
                if (questionId) {
                    answers[questionId] = answer.attributes.value;
                }
            });
        }

        // Fetch event details
        const eventResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/events/${event_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let event = null;
        if (eventResponse.ok) {
            const eventData = await eventResponse.json();
            event = {
                name: eventData.data.attributes.name,
                starts_at: eventData.data.attributes.starts_at,
                ends_at: eventData.data.attributes.ends_at,
                summary: eventData.data.attributes.summary,
                description: eventData.data.attributes.description
            };
        }

        return Response.json({
            questions,
            answers,
            event
        });

    } catch (error) {
        console.error('Get approval details error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});