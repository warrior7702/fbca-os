
import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mic, Square, FileAudio, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function TestTranscription() {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Recording saved:', blob.size, 'bytes');
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      setUploadedUrl('');
      setResult(null);
      setError(null);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Recording started!");
    } catch (err) {
      console.error('❌ Recording error:', err);
      setError('Failed to start recording: ' + err.message);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(recordingIntervalRef.current);
      toast.success("Recording stopped");
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);
    
    try {
      // Step 1: Upload
      console.log('⬆️ Uploading audio...');
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
      });
      console.log('✅ Uploaded:', uploadResponse.file_url);
      setUploadedUrl(uploadResponse.file_url);
      
      setUploading(false);
      setTranscribing(true);
      
      // Step 2: Transcribe
      console.log('🎙️ Transcribing...');
      const response = await base44.functions.invoke('transcribeMeetingAudio', {
        audio_url: uploadResponse.file_url,
        meeting_subject: 'Test Recording',
        meeting_date: new Date().toISOString()
      });
      
      console.log('📥 Full response object:', response);
      console.log('📊 Response data:', response.data);
      console.log('📊 Response status:', response.status);
      
      if (response.data.success) {
        setResult(response.data);
        toast.success('Transcription complete!');
      } else {
        // Show detailed error from backend
        const errorMsg = response.data.error || 'Transcription failed';
        const step = response.data.step || 'unknown';
        const details = response.data.details || '';
        
        console.error('❌ Backend error:', {
          error: errorMsg,
          step: step,
          details: details
        });
        
        throw new Error(`[${step}] ${errorMsg}${details ? '\n\nDetails: ' + details : ''}`);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = err.message;
      if (err.response?.data) {
        const data = err.response.data;
        errorMessage = `Step: ${data.step || 'unknown'}\nError: ${data.error || err.message}`;
        if (data.details) {
          errorMessage += `\n\nDetails: ${data.details}`;
        }
      }
      
      setError(errorMessage);
      toast.error('Process failed - check console for details');
    } finally {
      setUploading(false);
      setTranscribing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Audio Transcription Test</h1>
          <p className="text-slate-600">Record audio from your microphone to test transcription</p>
        </div>

        {/* Recording Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Step 1: Record Audio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {!recording && !audioBlob && (
                <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700">
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </Button>
              )}
              
              {recording && (
                <>
                  <Button onClick={stopRecording} className="bg-red-600 hover:bg-red-700">
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                  </div>
                </>
              )}

              {audioBlob && !recording && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Recording saved ({Math.round(audioBlob.size / 1024)} KB)</span>
                </div>
              )}
            </div>

            {audioBlob && (
              <Button onClick={() => { setAudioBlob(null); setUploadedUrl(''); setResult(null); }} variant="outline">
                Record Again
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Process Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="w-5 h-5" />
              Step 2: Upload & Transcribe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleUploadAndTranscribe} 
              disabled={!audioBlob || uploading || transcribing}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : transcribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transcribing... (may take 30-60 seconds)
                </>
              ) : (
                'Upload & Transcribe'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {result && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle2 className="w-5 h-5" />
                Transcription Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.summary && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Summary</h3>
                  <p className="text-slate-700 text-sm">{result.summary}</p>
                </div>
              )}

              {result.action_items && result.action_items.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Action Items</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {result.action_items.map((item, idx) => (
                      <li key={idx} className="text-slate-700 text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.transcript && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Full Transcript</h3>
                  <div className="p-3 bg-slate-50 rounded-lg max-h-64 overflow-y-auto">
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{result.transcript}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
