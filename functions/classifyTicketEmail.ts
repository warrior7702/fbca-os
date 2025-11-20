import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { subject, body } = await req.json();
    
    if (!subject || !body) {
      return Response.json({
        error: 'Missing required fields: subject and body'
      }, { status: 400 });
    }

    const prompt = `You are a ticket classification system for FBCA. You receive an email subject and body. 
Your job is to classify it into exactly ONE of the following categories:

- Cleaning
- Maintenance
- Technology
- Cross-Department (when unclear or involves multiple departments)

Rules:
1. Classification depends ONLY on the request content, NOT on the requester.
2. Choose the category that best matches the intent and keywords.
3. When in doubt or if multiple departments are involved, choose Cross-Department.
4. You must always return valid JSON. No extra text.

CATEGORY DEFINITIONS:

Cleaning:
- spills, stains, trash, dirty areas, bathrooms, mopping, sweeping
- janitorial tasks, sanitation, "needs to be cleaned", odor issues

Maintenance:
- repairs, broken items, HVAC, lights out, leaks, plumbing, electrical
- furniture fixes, building issues, doors, windows, general facility upkeep
- mechanical issues, physical repairs to equipment or structures

Technology:
- computer issues, network, email, logins, printers, phones, software
- audio/video problems, projectors, tech booths, streaming, worship tech
- DOOR CODES and access control issues
- digital/electronic systems

Cross-Department:
- requests that involve multiple teams or are unclear
- issues that could reasonably fall into 2+ categories
- when confidence is low, default to this

EMAIL TO CLASSIFY:
Subject: ${subject}
Body: ${body}

OUTPUT FORMAT:
Return only this JSON. Do not add comments or extra words.

{
  "category": "Cleaning | Maintenance | Technology",
  "confidence": 0.00
}

Where:
- category is exactly one of the three strings.
- confidence is between 0 and 1 using your best estimate.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

    return Response.json({
      success: true,
      classification: result
    });

  } catch (error) {
    console.error('Classification error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});