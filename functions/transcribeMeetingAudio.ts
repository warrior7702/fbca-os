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

    // Step 1: Transcribe with Whisper
    console.log('3️⃣ Fetching audio file...');
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    }
    const audioBlob = await audioResponse.blob();
    console.log('✅ Audio fetched:', audioBlob.size, 'bytes');

    console.log('4️⃣ Transcribing with Whisper...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ Whisper API error:', whisperResponse.status, errorText);
      throw new Error(`Whisper API error (${whisperResponse.status}): ${errorText}`);
    }

    const whisperData = await whisperResponse.json();
    const transcript = whisperData.text;
    console.log('✅ Transcription complete:', transcript.substring(0, 100) + '...');

    // Step 2: Analyze with LLM
    console.log('5️⃣ Analyzing with LLM...');
    const prompt = `Analyze this meeting transcript and provide:

1. A concise summary (2-3 sentences)
2. A list of action items (if any)

Meeting: ${meeting_subject || 'Meeting'}
Date: ${meeting_date || 'N/A'}

Transcript:
${transcript}`;

    const analysisResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          action_items: { 
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    console.log('✅ Analysis complete');

    return Response.json({
      success: true,
      transcript: transcript,
      summary: analysisResponse.summary || '',
      action_items: analysisResponse.action_items || [],
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
      step: 'processing',
      details: error.stack
    }, { status: 500 });
  }
});