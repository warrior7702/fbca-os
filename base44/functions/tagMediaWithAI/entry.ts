import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileName, fileUrl, fileType } = await req.json();
    
    if (!fileName || !fileUrl) {
      return Response.json({ error: 'fileName and fileUrl required' }, { status: 400 });
    }

    // Determine ministry/category based on filename and type
    const prompt = `Analyze this file and suggest appropriate tags and categorization for a church media library:

File Name: ${fileName}
File Type: ${fileType || 'unknown'}

Provide:
1. Primary ministry category (Youth, Worship, Pastoral, Children, Outreach, Events, Admin, Facilities)
2. Content type (Sermon, Worship Recording, Event Photo, Document, Video, Template)
3. Suggested tags (topics, speakers, dates, themes)
4. Brief description

Consider context clues like dates in filename, ministry names, event types, etc.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          ministry: { type: "string" },
          content_type: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          description: { type: "string" },
          confidence: { type: "string" }
        }
      }
    });

    return Response.json({
      success: true,
      suggestions: aiResponse
    });

  } catch (error) {
    console.error('Error tagging media:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});