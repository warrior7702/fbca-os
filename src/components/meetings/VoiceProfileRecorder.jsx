import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2, User, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function VoiceProfileRecorder({ person, onSaved, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [samples, setSamples] = useState([]);
  
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
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Recording - please speak clearly for 5-10 seconds");
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const handleSaveSample = async () => {
    if (!audioBlob) return;

    setSaving(true);
    try {
      // Upload audio
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'voice-sample.webm', { type: 'audio/webm' })
      });

      // Transcribe sample
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getOpenAIKey()}`
        },
        body: formData
      });

      const whisperData = await whisperResponse.json();

      const newSample = {
        audio_url: uploadResponse.file_url,
        transcript: whisperData.text || '',
        recorded_date: new Date().toISOString(),
        duration: recordingTime
      };

      setSamples([...samples, newSample]);
      setAudioBlob(null);
      setRecordingTime(0);
      toast.success('Voice sample saved');
    } catch (error) {
      console.error('Error saving sample:', error);
      toast.error('Failed to save sample');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (samples.length === 0) {
      toast.error('Please record at least one voice sample');
      return;
    }

    setSaving(true);
    try {
      // Check if profile exists
      const existingProfiles = await base44.entities.VoiceProfile.filter({
        person_email: person.email
      });

      if (existingProfiles.length > 0) {
        // Update existing
        const existing = existingProfiles[0];
        await base44.entities.VoiceProfile.update(existing.id, {
          voice_samples: [...existing.voice_samples, ...samples]
        });
      } else {
        // Create new
        await base44.entities.VoiceProfile.create({
          person_name: person.name,
          person_email: person.email,
          voice_samples: samples
        });
      }

      toast.success(`Voice profile saved for ${person.name}`);
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save voice profile');
    } finally {
      setSaving(false);
    }
  };

  const getOpenAIKey = async () => {
    // This would need to be retrieved securely from backend
    return 'YOUR_OPENAI_KEY';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Voice Profile: {person.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Record 2-3 samples of this person speaking (5-10 seconds each) for voice identification.
        </p>

        {/* Recording Controls */}
        <div className="flex items-center gap-3 flex-wrap">
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
              <Badge className="bg-red-500 text-white animate-pulse">
                Recording: {formatTime(recordingTime)}
              </Badge>
            </>
          )}

          {audioBlob && (
            <>
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready to save ({formatTime(recordingTime)})
              </Badge>
              <Button onClick={handleSaveSample} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Sample
              </Button>
              <Button onClick={() => setAudioBlob(null)} variant="outline">
                Discard
              </Button>
            </>
          )}
        </div>

        {/* Saved Samples */}
        {samples.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Samples ({samples.length})</p>
            <div className="space-y-2">
              {samples.map((sample, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sample {idx + 1}</p>
                    <p className="text-xs text-slate-500">{sample.transcript?.substring(0, 50)}...</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSamples(samples.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProfile} 
            disabled={samples.length === 0 || saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Voice Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}