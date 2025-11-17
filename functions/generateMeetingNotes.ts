import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('========================================');
  console.log('🎙️ GENERATE MEETING NOTES');
  console.log('========================================');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      console.error('❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User:', user.email);

    const body = await req.json();
    const { audio_url, meeting_subject, meeting_date } = body;

    if (!audio_url) {
      console.error('❌ Missing audio_url');
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
    console.log('📝 Prompt length:', prompt.length);

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

    console.log('✅ AI Response received');
    console.log('📊 Response keys:', Object.keys(llmResponse || {}));

    return Response.json({
      success: true,
      summary: llmResponse.summary || '',
      action_items: llmResponse.action_items || [],
      key_points: llmResponse.key_points || [],
      decisions: llmResponse.decisions || [],
      transcript: llmResponse.transcript || '',
      meeting_subject,
      meeting_date
    });

  } catch (error) {
    console.error('========================================');
    console.error('❌ ERROR generating meeting notes:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to generate meeting notes',
      details: error.stack
    }, { status: 500 });
  }
});