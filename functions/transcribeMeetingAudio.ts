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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not configured');
      return Response.json({ 
        success: false,
        error: 'OPENAI_API_KEY not configured in environment variables',
        step: 'configuration'
      }, { status: 500 });
    }
    console.log('✅ OpenAI API key found');

    // Step 1: Download the audio file
    console.log('3️⃣ Downloading audio file from:', audio_url);
    let audioResponse;
    try {
      audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        throw new Error(`HTTP ${audioResponse.status}: ${audioResponse.statusText}`);
      }
    } catch (downloadError) {
      console.error('❌ Download failed:', downloadError);
      return Response.json({ 
        success: false,
        error: `Failed to download audio: ${downloadError.message}`,
        step: 'download',
        audio_url
      }, { status: 500 });
    }
    
    const audioBlob = await audioResponse.blob();
    console.log('✅ Audio downloaded:', audioBlob.size, 'bytes, type:', audioBlob.type);

    // Step 2: Transcribe with Whisper
    console.log('4️⃣ Transcribing with Whisper...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    let transcriptionResponse;
    try {
      transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('❌ Whisper API error response:', errorText);
        throw new Error(`Whisper API returned ${transcriptionResponse.status}: ${errorText}`);
      }
    } catch (whisperError) {
      console.error('❌ Whisper request failed:', whisperError);
      return Response.json({ 
        success: false,
        error: `Whisper transcription failed: ${whisperError.message}`,
        step: 'whisper',
        details: whisperError.toString()
      }, { status: 500 });
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcript = transcriptionData.text;
    console.log('✅ Transcription complete:', transcript.length, 'characters');
    console.log('📝 Transcript preview:', transcript.substring(0, 100));

    // Step 3: Generate summary and action items with GPT
    console.log('5️⃣ Generating summary with GPT...');
    const prompt = `You are analyzing a meeting transcript. Please provide:

1. A concise summary (2-3 sentences)
2. A list of action items (if any)

Meeting: ${meeting_subject || 'Meeting'}
Date: ${meeting_date || 'N/A'}

Transcript:
${transcript}

Respond in JSON format:
{
  "summary": "your summary here",
  "action_items": ["action 1", "action 2"]
}`;

    let gptResponse;
    try {
      gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful meeting assistant that summarizes meetings and extracts action items.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!gptResponse.ok) {
        const errorText = await gptResponse.text();
        console.error('❌ GPT API error response:', errorText);
        throw new Error(`GPT API returned ${gptResponse.status}: ${errorText}`);
      }
    } catch (gptError) {
      console.error('❌ GPT request failed:', gptError);
      return Response.json({ 
        success: false,
        error: `GPT summarization failed: ${gptError.message}`,
        step: 'gpt',
        transcript: transcript,
        details: gptError.toString()
      }, { status: 500 });
    }

    const gptData = await gptResponse.json();
    const analysisText = gptData.choices[0].message.content;
    const analysis = JSON.parse(analysisText);
    
    console.log('✅ Analysis complete');
    console.log('📊 Summary length:', analysis.summary?.length || 0);
    console.log('📋 Action items:', analysis.action_items?.length || 0);

    return Response.json({
      success: true,
      transcript: transcript,
      summary: analysis.summary || '',
      action_items: analysis.action_items || [],
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
      step: 'unknown',
      details: error.stack,
      errorType: error.constructor.name
    }, { status: 500 });
  }
});