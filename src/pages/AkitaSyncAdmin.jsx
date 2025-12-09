import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function AkitaSyncAdmin() {
  const navigate = useNavigate();
  const [floorsFile, setFloorsFile] = useState(null);
  const [roomsFile, setRoomsFile] = useState(null);
  const [assetsFile, setAssetsFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!floorsFile || !roomsFile || !assetsFile) {
      toast.error('Please upload all three files');
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      // Upload files
      const [floorsUpload, roomsUpload, assetsUpload] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: floorsFile }),
        base44.integrations.Core.UploadFile({ file: roomsFile }),
        base44.integrations.Core.UploadFile({ file: assetsFile })
      ]);

      // Call import function
      const response = await base44.functions.invoke('akitaSyncImport', {
        floorsFileUrl: floorsUpload.file_url,
        roomsFileUrl: roomsUpload.file_url,
        assetsFileUrl: assetsUpload.file_url
      });

      if (response.data.success) {
        setResult(response.data.summary);
        toast.success('Import completed successfully');
      } else {
        throw new Error(response.data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
      setResult({ errors: [error.message] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AkitaSync Import</h1>
            <p className="text-sm text-slate-600">Import floors, rooms, and assets from AkitaBox exports</p>
          </div>
        </div>

        {/* Instructions */}
        <Alert>
          <Database className="w-4 h-4" />
          <AlertDescription>
            <strong>How to use:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Export Floors, Rooms, and Assets from AkitaBox as CSV files</li>
              <li>Upload the three files below</li>
              <li>Click "Run Import" to sync the data into Base44</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* File Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Export Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Floors Export (CSV)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setFloorsFile(e.target.files[0])}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {floorsFile && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {floorsFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Rooms Export (CSV)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setRoomsFile(e.target.files[0])}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {roomsFile && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {roomsFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Assets Export (CSV)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setAssetsFile(e.target.files[0])}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {assetsFile && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {assetsFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={!floorsFile || !roomsFile || !assetsFile || importing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Run Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.errors?.length > 0 ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    Import Completed with Warnings
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Import Successful
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Buildings Created</p>
                  <p className="text-2xl font-bold text-slate-900">{result.buildingsCreated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Buildings Updated</p>
                  <p className="text-2xl font-bold text-slate-900">{result.buildingsUpdated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Floors Created</p>
                  <p className="text-2xl font-bold text-slate-900">{result.floorsCreated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Floors Updated</p>
                  <p className="text-2xl font-bold text-slate-900">{result.floorsUpdated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Rooms Created</p>
                  <p className="text-2xl font-bold text-slate-900">{result.roomsCreated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Rooms Updated</p>
                  <p className="text-2xl font-bold text-slate-900">{result.roomsUpdated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Assets Created</p>
                  <p className="text-2xl font-bold text-slate-900">{result.assetsCreated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Assets Updated</p>
                  <p className="text-2xl font-bold text-slate-900">{result.assetsUpdated || 0}</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-2">
                    Errors ({result.errors.length})
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-amber-800 mb-1">{error}</p>
                    ))}
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