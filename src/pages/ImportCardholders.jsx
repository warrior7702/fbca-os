import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export default function ImportCardholders() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      let cardholders;

      // Try parsing as JSON first
      if (file.name.endsWith('.json')) {
        cardholders = JSON.parse(text);
        // If it's an array directly, use it. If it's wrapped in an object, extract it
        if (!Array.isArray(cardholders)) {
          cardholders = cardholders.cardholders || Object.values(cardholders);
        }
      } 
      // Parse CSV
      else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        cardholders = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj = {};
          
          headers.forEach((header, idx) => {
            // Map common header variations
            if (header.includes('name')) obj.name = values[idx];
            else if (header.includes('pin') || header.includes('code')) obj.pin = values[idx];
            else if (header.includes('member')) obj.member_id = values[idx];
            else if (header.includes('email')) obj.email = values[idx];
          });
          
          return obj;
        }).filter(c => c.name && c.pin); // Only keep valid records
      } else {
        throw new Error('Please upload a .csv or .json file');
      }

      console.log(`📤 Uploading ${cardholders.length} cardholders...`);

      // Call the import function
      const response = await base44.functions.invoke('importCardholders', { 
        cardholders 
      });

      if (response.data.ok) {
        setResult(response.data);
        toast.success(`Successfully imported ${response.data.imported} cardholders!`);
      } else {
        throw new Error(response.data.error || 'Import failed');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,pin,member_id,email
John Doe,123456,M001,john@example.com
Jane Smith,654321,M002,jane@example.com`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cardholders_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Template downloaded!');
  };

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Import Cardholders</h1>
            <p className="text-slate-600">Upload your cardholders database</p>
          </div>
        </div>

        {/* Instructions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>How to Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">Prepare your file</p>
                <p className="text-sm text-slate-600">Upload either <code className="bg-slate-100 px-1 py-0.5 rounded">cardholders_with_pins.csv</code> or <code className="bg-slate-100 px-1 py-0.5 rounded">cardholders_min.json</code></p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">Required fields</p>
                <p className="text-sm text-slate-600"><code className="bg-slate-100 px-1 py-0.5 rounded">name</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">pin</code> (6 digits)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">Optional fields</p>
                <p className="text-sm text-slate-600"><code className="bg-slate-100 px-1 py-0.5 rounded">member_id</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">email</code></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-900 mb-2">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Supports .csv and .json files
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  disabled={importing}
                  className="hidden"
                />
                <Button disabled={importing} className="bg-blue-600 hover:bg-blue-700">
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Select File
                    </>
                  )}
                </Button>
              </label>
            </div>

            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Success Result */}
        {result && (
          <Alert className="border-green-300 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Success!</strong> Imported {result.imported} cardholders into the database.
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Import failed:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Security Note */}
        <Card className="mt-6 border-yellow-300 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">Security Note</p>
                <p className="text-sm text-yellow-800">
                  Door codes are stored securely and only accessible via server-side lookups. 
                  Only admins can import cardholders.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}