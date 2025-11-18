import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('========================================');
  console.log('🎙️ TRANSCRIBE MEETING AUDIO');
  console.log('========================================');
  
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('1️⃣ Checking authentication...');
    const user = await base44.auth.me();
    if (!user) {
      console.error('❌ No authenticated user');
      return Response.json({ 
        success: false,
        error: 'Unauthorized',
        step: 'authentication'
      }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.email);

    console.log('2️⃣ Parsing request body...');
    const body = await req.json();
    const { audio_url, meeting_subject, meeting_date } = body;

    if (!audio_url) {
      console.error('❌ Missing audio_url');
      return Response.json({ 
        success: false,
        error: 'Missing audio_url',
        step: 'validation'
      }, { status: 400 });
    }

    console.log('✅ Request parsed successfully');
    console.log('📎 Audio URL:', audio_url);
    console.log('📋 Meeting:', meeting_subject);

    // Use InvokeLLM with audio file
    console.log('3️⃣ Processing audio with InvokeLLM...');
    
    const prompt = `You are analyzing an audio recording of a meeting. Please provide:

1. A full transcript of what was said
2. A concise summary (2-3 sentences)
3. A list of action items (if any)

Meeting: ${meeting_subject || 'Meeting'}
Date: ${meeting_date || 'N/A'}

Respond in JSON format with this structure:
{
  "transcript": "full transcript here",
  "summary": "your summary here",
  "action_items": ["action 1", "action 2"]
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [audio_url],
      response_json_schema: {
        type: "object",
        properties: {
          transcript: { type: "string" },
          summary: { type: "string" },
          action_items: { 
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    console.log('✅ Analysis complete');
    console.log('📊 Response:', response);

    return Response.json({
      success: true,
      transcript: response.transcript || '',
      summary: response.summary || '',
      action_items: response.action_items || [],
      meeting_subject,
      meeting_date
    });

  } catch (error) {
    console.error('========================================');
    console.error('❌ FATAL ERROR:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to transcribe meeting audio',
      step: 'llm_processing',
      details: error.stack,
      errorType: error.constructor.name
    }, { status: 500 });
  }
});