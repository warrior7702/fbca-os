import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@4.20.1';

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
  console.log('🎙️ ========== GENERATE MEETING NOTES ==========');
  
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      console.error('❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.email);

    const body = await req.json();
    const { audio_url, meeting_subject, meeting_date } = body;

    if (!audio_url) {
      console.error('❌ Missing audio_url');
      return Response.json({ error: 'Missing audio_url' }, { status: 400 });
    }

    console.log('📎 Audio URL:', audio_url);
    console.log('📋 Meeting:', meeting_subject);

    // Step 1: Download the audio file
    console.log('⬇️ Downloading audio file...');
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    const audioBlob = await audioResponse.blob();
    console.log('✅ Audio downloaded:', audioBlob.size, 'bytes');

    // Step 2: Transcribe with Whisper
    console.log('🎧 Transcribing with Whisper...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');

    const transcription = await openai.audio.transcriptions.create({
      file: await fetch(audio_url).then(r => r.blob()).then(b => new File([b], 'recording.webm', { type: 'audio/webm' })),
      model: 'whisper-1',
    });

    console.log('✅ Transcription complete');
    console.log('📝 Transcript length:', transcription.text.length, 'characters');

    // Step 3: Generate notes with GPT
    console.log('🤖 Generating meeting notes with GPT...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional meeting note-taker. Analyze meeting transcripts and create clear, actionable summaries.'
        },
        {
          role: 'user',
          content: `Please analyze this meeting transcript and provide:

1. A concise summary (2-3 sentences)
2. A list of action items (if any)
3. The full transcript

Meeting: ${meeting_subject || 'Meeting'}
Date: ${meeting_date || 'N/A'}

Transcript:
${transcription.text}

Respond in JSON format:
{
  "summary": "Brief summary here",
  "action_items": ["action 1", "action 2"],
  "transcript": "Full transcript here"
}`
        }
      ],
      response_format: { type: "json_object" }
    });

    console.log('✅ GPT response received');
    
    const result = JSON.parse(completion.choices[0].message.content);
    
    return Response.json({
      success: true,
      summary: result.summary || 'No summary generated',
      action_items: result.action_items || [],
      transcript: result.transcript || transcription.text,
      meeting_subject,
      meeting_date
    });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to generate meeting notes',
    }, { status: 500 });
  }
});