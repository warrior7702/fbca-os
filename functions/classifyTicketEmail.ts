import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClient().asServiceRole;
    
    const { subject, body } = await req.json();
    
    if (!subject || !body) {
      return Response.json({
        error: 'Missing required fields: subject and body'
      }, { status: 400 });
    }

    const prompt = `You are a ticket classification system for FBCA. Classify this email into exactly ONE category:

- Cleaning
- Maintenance
- Technology

EMAIL:
Subject: ${subject}
Body: ${body}

Return only JSON:
{
  "category": "Cleaning | Maintenance | Technology",
  "confidence": 0.00
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["Cleaning", "Maintenance", "Technology"]
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1
          }
        },
        required: ["category", "confidence"]
      }
    });

    // Return with dept field for Zapier
    return Response.json({
      success: true,
      dept: result.category,
      classification: result
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});