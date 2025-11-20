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

- Technology
- Cleaning
- Janitorial
- Other (when unclear or doesn't fit above categories)

Rules:
1. Classification depends ONLY on the request content, NOT on the requester.
2. Choose the category that best matches the intent and keywords.
3. When in doubt or if it doesn't clearly fit Technology/Cleaning/Janitorial, choose Other.
4. You must always return valid JSON. No extra text.

CATEGORY DEFINITIONS:

Technology:
- computer issues, network, email, logins, printers, phones, software
- audio/video problems, projectors, tech booths, streaming, worship tech
- DOOR CODES and access control issues (critical: these are always Technology)
- digital/electronic systems, apps, software

Cleaning:
- routine cleaning, spills, stains, trash removal
- bathroom cleaning, mopping, sweeping
- general tidying up

Janitorial:
- deeper cleaning tasks, maintenance of janitorial equipment
- floor care, window washing, carpet cleaning
- sanitation projects, odor treatment

Other:
- mechanical repairs, HVAC, plumbing, electrical
- furniture fixes, building maintenance
- event setup, communications requests
- anything that doesn't fit the above three categories

EMAIL TO CLASSIFY:
Subject: ${subject}
Body: ${body}

OUTPUT FORMAT:
Return only this JSON. Do not add comments or extra words.

{
  "category": "Technology | Cleaning | Janitorial | Other",
  "confidence": 0.00
}

Where:
- category is exactly one of the four strings.
- confidence is between 0 and 1 using your best estimate.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["Technology", "Cleaning", "Janitorial", "Other"]
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