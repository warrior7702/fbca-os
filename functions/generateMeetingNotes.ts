import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { audio_url, meeting_subject, meeting_date } = body;

    if (!audio_url) {
      return Response.json({ error: 'Missing audio_url' }, { status: 400 });
    }

    console.log('🎙️ Generating meeting notes from audio...');
    console.log('📎 Audio URL:', audio_url);
    console.log('📋 Meeting:', meeting_subject);

    // Use InvokeLLM with file attachment to transcribe and generate notes
    const prompt = `You are an AI meeting assistant. Analyze this meeting recording and provide:

1. A concise summary of the meeting (2-3 paragraphs)
2. Key discussion points
3. Action items and decisions made
4. A full transcript of the conversation

Meeting Details:
- Subject: ${meeting_subject || 'Meeting'}
- Date: ${meeting_date || 'N/A'}

Format your response as JSON with this structure:
{
  "summary": "Meeting summary here",
  "key_points": ["point 1", "point 2", ...],
  "action_items": ["action 1", "action 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "transcript": "Full transcript here"
}`;

    console.log('🤖 Calling AI to process audio...');

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [audio_url],
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_points: { 
            type: "array",
            items: { type: "string" }
          },
          action_items: { 
            type: "array",
            items: { type: "string" }
          },
          decisions: { 
            type: "array",
            items: { type: "string" }
          },
          transcript: { type: "string" }
        }
      }
    });

    console.log('✅ Notes generated successfully');

    return Response.json({
      success: true,
      ...llmResponse,
      meeting_subject,
      meeting_date
    });

  } catch (error) {
    console.error('❌ Error generating meeting notes:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to generate meeting notes'
    }, { status: 500 });
  }
});