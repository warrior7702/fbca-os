import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, FileAudio, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function TestTranscription() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedUrl('');
      setResult(null);
      setError(null);
      console.log('📁 File selected:', selectedFile.name, selectedFile.type, selectedFile.size, 'bytes');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      console.log('⬆️ Uploading file...');
      const response = await base44.integrations.Core.UploadFile({ file });
      console.log('✅ Upload response:', response);
      setUploadedUrl(response.file_url);
      toast.success('File uploaded!');
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError('Upload failed: ' + err.message);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!uploadedUrl) return;

    setTranscribing(true);
    setError(null);
    try {
      console.log('🎙️ Transcribing audio...');
      const response = await base44.functions.invoke('transcribeMeetingAudio', {
        audio_url: uploadedUrl,
        meeting_subject: 'Test Meeting',
        meeting_date: new Date().toISOString()
      });
      
      console.log('✅ Transcription response:', response);
      
      if (response.data.success) {
        setResult(response.data);
        toast.success('Transcription complete!');
      } else {
        throw new Error(response.data.error || 'Transcription failed');
      }
    } catch (err) {
      console.error('❌ Transcription error:', err);
      setError('Transcription failed: ' + err.message);
      toast.error('Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Audio Transcription Test</h1>
          <p className="text-slate-600">Upload an audio file to test the transcription functionality</p>
        </div>

        {/* Step 1: Upload File */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Upload Audio File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            
            {file && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileAudio className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-slate-400">({Math.round(file.size / 1024)} KB)</span>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>

            {uploadedUrl && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>File uploaded successfully!</span>
                </div>
                <p className="text-xs text-green-600 mt-1 break-all">{uploadedUrl}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Transcribe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="w-5 h-5" />
              Step 2: Transcribe Audio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleTranscribe} 
              disabled={!uploadedUrl || transcribing}
              className="w-full"
            >
              {transcribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transcribing... (this may take 30-60 seconds)
                </>
              ) : (
                'Start Transcription'
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
                  <p className="text-sm text-red-700 mt-1">{error}</p>
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