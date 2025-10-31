import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle, Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";

export default function ImportCardholders() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('CSV file is empty');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    console.log('📋 CSV Headers:', headers);

    const cardholders = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle quoted values
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      const obj = {};
      headers.forEach((header, idx) => {
        const value = values[idx] || '';
        // Map all possible header variations
        if (header.includes('name') || header === 'full_name' || header === 'fullname') {
          obj.name = value;
        } else if (header.includes('pin') || header.includes('code') || header === 'door_code') {
          obj.pin = value.padStart(6, '0'); // Ensure 6 digits
        } else if (header.includes('member') || header === 'member_id' || header === 'memberid') {
          obj.member_id = value;
        } else if (header.includes('email') || header === 'email_address') {
          obj.email = value;
        }
      });

      if (obj.name && obj.pin) {
        cardholders.push(obj);
      }
    }

    return cardholders;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('📁 File selected:', file.name, file.type);

    setImporting(true);
    setError(null);
    setResult(null);
    setPreview(null);

    try {
      const text = await file.text();
      console.log('📄 File content length:', text.length);
      
      let cardholders;

      // Parse JSON
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        cardholders = Array.isArray(parsed) ? parsed : (parsed.cardholders || Object.values(parsed));
        
        // Ensure pins are 6 digits
        cardholders = cardholders.map(c => ({
          ...c,
          pin: String(c.pin || c.pin_code || '').padStart(6, '0')
        }));
      } 
      // Parse CSV
      else if (file.name.endsWith('.csv')) {
        cardholders = parseCSV(text);
      } else {
        throw new Error('Please upload a .csv or .json file');
      }

      if (!cardholders || cardholders.length === 0) {
        throw new Error('No valid cardholders found in file');
      }

      console.log(`✅ Parsed ${cardholders.length} cardholders`);
      console.log('📋 First record:', cardholders[0]);

      // Show preview
      setPreview(cardholders.slice(0, 3));

      // Call the import function
      const response = await base44.functions.invoke('importCardholders', { 
        cardholders 
      });

      console.log('🔄 Import response:', response.data);

      if (response.data.ok) {
        setResult(response.data);
        toast.success(`Successfully imported ${response.data.imported} cardholders!`);
      } else {
        throw new Error(response.data.error || 'Import failed');
      }
    } catch (err) {
      console.error('❌ Import error:', err);
      setError(err.message);
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,pin,member_id,email
John Doe,123456,M001,john@example.com
Jane Smith,654321,M002,jane@example.com
Bob Wilson,111222,M003,bob@example.com`;
    
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
            <p className="text-slate-600">Upload your cardholders database for door code lookup</p>
          </div>
        </div>

        {/* Instructions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">Upload your file</p>
                <p className="text-sm text-slate-600">
                  Upload <code className="bg-slate-100 px-1 py-0.5 rounded">cardholders_with_pins.csv</code> or <code className="bg-slate-100 px-1 py-0.5 rounded">cardholders_min.json</code>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">Required columns</p>
                <p className="text-sm text-slate-600">
                  <code className="bg-slate-100 px-1 py-0.5 rounded">name</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">pin</code> (6 digits)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">Use in approvals</p>
                <p className="text-sm text-slate-600">
                  Go to <strong>My Approvals</strong> → Search by name or door code → Send to Planning Center
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className="mb-6 border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  disabled={importing}
                  className="hidden"
                />
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-900 mb-2">
                  Click to browse or drag file here
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  Supports .csv and .json files
                </p>
                <Button disabled={importing} className="bg-blue-600 hover:bg-blue-700">
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
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

        {/* Preview */}
        {preview && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-sm">Preview (first 3 records)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {preview.map((c, idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-blue-200 text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-slate-600 ml-2">• PIN: {c.pin}</span>
                    {c.member_id && <span className="text-slate-600 ml-2">• ID: {c.member_id}</span>}
                    {c.email && <span className="text-slate-600 ml-2">• {c.email}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Result */}
        {result && (
          <Alert className="border-green-300 bg-green-50 mb-6">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Success!</strong> Imported {result.imported} cardholders. 
              <br/>
              <span className="text-sm">You can now search for them in <strong>My Approvals</strong> → Door Code section.</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Import failed:</strong> {error}
              <br/>
              <span className="text-sm">Make sure your file has 'name' and 'pin' columns.</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Security Note */}
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">🔒 Security & Privacy</p>
                <p className="text-sm text-yellow-800">
                  Door codes are stored securely in the database and only accessible via server-side search. 
                  The lookup feature on My Approvals uses encrypted queries to protect sensitive PIN data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}