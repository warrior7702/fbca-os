import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query } = await req.json();

    if (!query) {
      return Response.json({ error: 'Query required' }, { status: 400 });
    }

    // Use AI to interpret the command
    const interpretation = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI assistant for a church management system. Interpret this user command and extract the intent and parameters.

User command: "${query}"

Determine if this is:
1. A search query (just looking for information)
2. A meeting request (book/schedule meeting with someone)
3. A ticket creation (create/submit ticket, report issue)
4. A task creation (create task, add to-do, remind me)

Extract relevant parameters like person names, dates, times, descriptions, etc.

Return a structured response.`,
      response_json_schema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: ["search", "book_meeting", "create_ticket", "create_task", "unclear"]
          },
          confidence: {
            type: "number",
            description: "0-1 confidence score"
          },
          parameters: {
            type: "object",
            properties: {
              person_name: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              description: { type: "string" },
              subject: { type: "string" },
              priority: { type: "string" },
              category: { type: "string" },
              search_terms: { type: "string" }
            }
          },
          suggested_action: {
            type: "string",
            description: "Natural language description of what will happen"
          }
        },
        required: ["intent", "confidence", "suggested_action"]
      }
    });

    // If it's a meeting request, search for the person
    let person = null;
    if (interpretation.intent === 'book_meeting' && interpretation.parameters?.person_name) {
      try {
        const staffResponse = await base44.functions.invoke('getMicrosoftUsers', {
          searchQuery: interpretation.parameters.person_name
        });
        
        if (staffResponse.data.success && staffResponse.data.users.length > 0) {
          person = staffResponse.data.users[0];
        }
      } catch (error) {
        console.error('Error finding person:', error);
      }
    }

    return Response.json({
      success: true,
      interpretation,
      person
    });

  } catch (error) {
    console.error('AI command interpreter error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});