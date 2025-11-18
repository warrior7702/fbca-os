import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('========================================');
  console.log('🎙️ GENERATE MEETING NOTES');
  console.log('========================================');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    console.log('1️⃣ Checking authentication...');
    const user = await base44.auth.me();
    if (!user) {
      console.error('❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.email);

    console.log('2️⃣ Parsing request body...');
    const body = await req.json();
    const { audio_url, meeting_subject, meeting_date } = body;

    if (!audio_url) {
      console.error('❌ Missing audio_url');
      return Response.json({ error: 'Missing audio_url' }, { status: 400 });
    }

    console.log('✅ Request parsed successfully');
    console.log('📎 Audio URL:', audio_url);
    console.log('📋 Meeting:', meeting_subject);
    console.log('📅 Date:', meeting_date);

    // Simpler prompt for testing
    const prompt = `Please transcribe and summarize this meeting audio recording.

Meeting: ${meeting_subject || 'Meeting'}
Date: ${meeting_date || 'N/A'}

Provide:
1. A brief summary (2-3 sentences)
2. Key action items (if any)
3. A transcript of what was said

Format as JSON with: summary, action_items (array), transcript`;

    console.log('3️⃣ Calling InvokeLLM...');
    console.log('📝 Prompt length:', prompt.length, 'characters');
    console.log('🔗 File URL being sent:', audio_url);

    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        file_urls: [audio_url],
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            action_items: { 
              type: "array",
              items: { type: "string" }
            },
            transcript: { type: "string" }
          },
          required: ["summary", "transcript"]
        }
      });

      console.log('✅ LLM Response received');
      console.log('📊 Response type:', typeof llmResponse);
      console.log('📊 Response keys:', Object.keys(llmResponse || {}));

      return Response.json({
        success: true,
        summary: llmResponse?.summary || 'No summary generated',
        action_items: llmResponse?.action_items || [],
        transcript: llmResponse?.transcript || 'No transcript available',
        meeting_subject,
        meeting_date
      });

    } catch (llmError) {
      console.error('❌ LLM Error:', llmError);
      console.error('LLM Error message:', llmError.message);
      console.error('LLM Error stack:', llmError.stack);
      throw new Error(`LLM processing failed: ${llmError.message}`);
    }

  } catch (error) {
    console.error('========================================');
    console.error('❌ FATAL ERROR:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to generate meeting notes',
      errorType: error.constructor.name,
      details: error.stack
    }, { status: 500 });
  }
});