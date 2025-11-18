import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Loader2, User, Trash2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const TRAINING_PHRASES = [
  "Hello, my name is {name} and I work at First Baptist Church.",
  "I am responsible for coordinating events and managing our team.",
  "Our weekly team meetings are essential for staying aligned on projects.",
  "Thank you for attending today's meeting, I appreciate everyone's input.",
  "Let's review the action items from our last discussion and plan next steps."
];

export default function VoiceProfileRecorder({ person, onSaved, onCancel, guided = false }) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [samples, setSamples] = useState([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [mode, setMode] = useState(guided ? 'guided' : 'select'); // 'select', 'guided', 'freeform'
  
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

      toast.success(mode === 'guided' ? "Recording - read the phrase aloud" : "Recording started");
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
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'voice-sample.webm', { type: 'audio/webm' })
      });

      const newSample = {
        audio_url: uploadResponse.file_url,
        transcript: mode === 'guided' ? getCurrentPhrase() : '',
        recorded_date: new Date().toISOString(),
        duration: recordingTime
      };

      setSamples([...samples, newSample]);
      setAudioBlob(null);
      setRecordingTime(0);
      
      if (mode === 'guided' && currentPhraseIndex < TRAINING_PHRASES.length - 1) {
        setCurrentPhraseIndex(currentPhraseIndex + 1);
        toast.success('Sample saved! Next phrase ready');
      } else {
        toast.success('Voice sample saved');
      }
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
      const existingProfiles = await base44.entities.VoiceProfile.filter({
        person_email: person.email
      });

      if (existingProfiles.length > 0) {
        const existing = existingProfiles[0];
        await base44.entities.VoiceProfile.update(existing.id, {
          voice_samples: [...existing.voice_samples, ...samples]
        });
      } else {
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

  const getCurrentPhrase = () => {
    return TRAINING_PHRASES[currentPhraseIndex].replace('{name}', person.name);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'guided' ? ((samples.length / TRAINING_PHRASES.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Voice Training: {person.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'select' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Choose how to record voice samples:
            </p>
            <div className="grid gap-3">
              <button
                onClick={() => setMode('guided')}
                className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Guided Training (Recommended)</p>
                    <p className="text-sm text-slate-600">
                      Record {TRAINING_PHRASES.length} specific phrases for optimal voice recognition
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                </div>
              </button>
              <button
                onClick={() => setMode('freeform')}
                className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Free-form Recording</p>
                    <p className="text-sm text-slate-600">
                      Record 2-3 samples of natural speech (5-10 seconds each)
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0 mt-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {mode === 'guided' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  Training Progress: {samples.length} / {TRAINING_PHRASES.length}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode('select');
                    setSamples([]);
                    setCurrentPhraseIndex(0);
                  }}
                >
                  Change Mode
                </Button>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {samples.length < TRAINING_PHRASES.length && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-blue-600 font-medium mb-2">
                    PHRASE {currentPhraseIndex + 1} OF {TRAINING_PHRASES.length}
                  </p>
                  <p className="text-lg font-medium text-slate-900 leading-relaxed">
                    "{getCurrentPhrase()}"
                  </p>
                </CardContent>
              </Card>
            )}

            {samples.length === TRAINING_PHRASES.length && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="pt-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-900">
                    Training Complete!
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    All {TRAINING_PHRASES.length} phrases recorded successfully
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {mode === 'freeform' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Record 2-3 samples of this person speaking naturally (5-10 seconds each)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('select');
                  setSamples([]);
                }}
              >
                Change Mode
              </Button>
            </div>
          </div>
        )}

        {mode !== 'select' && (
          <>
            {/* Recording Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {!recording && !audioBlob && samples.length < (mode === 'guided' ? TRAINING_PHRASES.length : 10) && (
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
                    Ready ({formatTime(recordingTime)})
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
                <p className="text-sm font-medium">Recorded Samples ({samples.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {samples.map((sample, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Sample {idx + 1}</p>
                        {sample.transcript && (
                          <p className="text-xs text-slate-500 truncate">{sample.transcript}</p>
                        )}
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
                Save Voice Profile ({samples.length} samples)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}