import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AkitaSyncAdmin() {
  const navigate = useNavigate();
  const [floorsFile, setFloorsFile] = useState(null);
  const [roomsFile, setRoomsFile] = useState(null);
  const [assetsFiles, setAssetsFiles] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importMode, setImportMode] = useState('all');
  const [skipRows, setSkipRows] = useState(0);
  const [limitRows, setLimitRows] = useState(10);
  const [skipAssets, setSkipAssets] = useState(0);
  const [limitAssets, setLimitAssets] = useState(5);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const [buildings, floors, rooms, assets] = await Promise.all([
        base44.entities.Building.list(),
        base44.entities.Floor.list(),
        base44.entities.Room.list(),
        base44.entities.Asset.list()
      ]);
      setStats({
        buildings: buildings.length,
        floors: floors.length,
        rooms: rooms.length,
        assets: assets.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleImport = async () => {
    // Validate based on import mode
    if (importMode === 'floors' && !floorsFile) {
      toast.error('Please upload floors file');
      return;
    }
    if (importMode === 'rooms' && !roomsFile) {
      toast.error('Please upload rooms file');
      return;
    }
    if (importMode === 'assets' && assetsFiles.length === 0) {
      toast.error('Please upload at least one assets file');
      return;
    }
    if (importMode === 'all' && (!floorsFile || !roomsFile || assetsFiles.length === 0)) {
      toast.error('Please upload all files');
      return;
    }

    setImporting(true);
    setResult(null);
    setImportProgress(null);

    try {
      // Upload files based on mode
      let floorsFileId = null;
      let roomsFileId = null;
      let assetsFileId = null;
      
      if (importMode === 'floors' || importMode === 'all') {
        const upload = await base44.integrations.Core.UploadFile({ file: floorsFile });
        floorsFileId = upload.file_url.split('/').pop();
      }
      if (importMode === 'rooms' || importMode === 'all') {
        const upload = await base44.integrations.Core.UploadFile({ file: roomsFile });
        roomsFileId = upload.file_url.split('/').pop();
      }
      if (importMode === 'assets' || importMode === 'all') {
        const upload = await base44.integrations.Core.UploadFile({ file: assetsFiles[0] });
        assetsFileId = upload.file_url.split('/').pop();
      }

      // Show progress estimate
      if (importMode === 'assets' || importMode === 'all') {
        setImportProgress(`Processing assets ${skipAssets} to ${skipAssets + limitAssets}...`);
      } else if (importMode === 'rooms') {
        setImportProgress(`Processing rooms ${skipRows} to ${skipRows + limitRows}...`);
      } else {
        setImportProgress('Processing data...');
      }

      // Call import function
      const response = await base44.functions.invoke('akitaSyncImport', {
        floorsFileId,
        roomsFileId,
        assetsFileId,
        skipRows: importMode === 'rooms' ? skipRows : undefined,
        limitRows: importMode === 'rooms' ? limitRows : undefined,
        skipAssets: importMode === 'assets' ? skipAssets : undefined,
        limitAssets: importMode === 'assets' ? limitAssets : undefined
      });

      if (response.data.success) {
        setResult(response.data.summary);
        toast.success('Import completed successfully');
        loadStats(); // Refresh stats after import

        // Play success sound
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGGS57OmjTgwOUKXh8LRiGwU7k9r0ynksBSh+zPDekj8NEmCy6OuqVhIKR6Hf8r1tIgUpf83w25A9CRdrs+zpoU4LDlKm4O+0YhsGOpHY8sl4LAUmfszw3ZI/DBRcs+jrq1YRCUZ/3vG9bCIFKH7M8N2SPwsVXrPo66xWEQtHod/yvWshBSp/zfHakD0JFWuz7OmnUQwOUqbg8LRiGwU7kdnzx3ksBSh+zPDekT0NFWCy6eurVxEKRZ/e8b1sIgUofszx3JM+CxZftOvqp1ELDlCm4fC0YhsGOpHY8sh4LAUng87x2pE9CxVZs+rroFQNClCl4O+1YRsFOpHa88t5KwYojc/z2I4+DRVdtejrrVkRCkag3vG+bSIFKIDN8dmRPwoVXLPn7qxXEwpGoN7yv2wiBSh/zfHakj4KFmCy5+6pVRMKRqDe8r1tIgUof83x2pI+Cxdet+vrqVUTCkag3vK+bCIFKX/M8dmRPQkUXbXo66xXEQpFoN7yvmwhBSh+zPHakj4MFF2z6OusVxEKRJ/e8r5sIgUof83w2pI+CxZftOrrqlUSCkWg3vK9bCEFKH7M8NqSPgoWXrPo66xXEgtGot7xvmwhBSh+zPDakj4MFF2z6OuqVREJRZ/e8r5sIgUofszw2pI+DRVds+nrrFcRCkag3vK+bCIFKH7M8NmSPgoWX7Tq66pWEwtGod7xvW0hBSh+zPDakj4MFF6z6OurVxEKRJ/e8r5sIgUof83w2pM+DRVes+jrq1cSCkag3fG9bCIFKH7N8NqSPgoWXrPo66xXEQpFn97xvm0hBSh+zPDZkj4MFV6z6OusVhIKRaDe8r5sIgUofszu3JM+CxZftOnrrFcSCkag3fG9bSIFKH7M8NmSPgoWXrPo66xXEQpFn97xvm0hBSh/zfDakj4NFWE16OuqVhEJRaDe8r1sIgUpf83w2pI+CxRdtOjrqlUSCkWg3vK+bCIFKH7M8NqSPQkVXbXo66tWEgtGot7xvWwhBSh+zfHakT4MFV6z6OuqVxEKRaDe8r1sIgUof83w2pM+DBVfs+jrq1cRCkSf3vG+bCIFKH7M8NmTPgoVX7Tq66tVEQlGod7xvWwhBSl/zPHYkj4KFV616OyrWBEKRaDe8r1tIgUofszw2ZI+CxVds+jrq1YRC0ef3vK+bCIFKH7N8NuRPwwUXrTn7qtXEgpGoN7xvWwiByiBz/LbkT8MGWKv6uqhTg4NVanm772LPQgYdMXz3pA+DRVks+jrq1cRCkSg3fK+bCIFKH7N8NqSPgwUXrXo66pWEQtGn97xvm0hBCl/zPHakj0LFmCy6OuqVhELRaDe8b5sIgUof83w2pI+ChRds+jrq1YSCkWg3fK+bSIFKH7N8NmRPQoWXrPo66tWEQpGn97xvWwhBSh/zfHakD0KFV+06OuqVxIKRqHf8b5tIgUof83w2ZI+CxVds+jrq1YRC0af3vG+bSEFKX/N8dqSPQoVX7Tn7qxXEgpFoN7yvmwhBSh/zfHakj0KFV616OurVxIKRqHf8b5tIQUof83w2pE+CxVds+jrq1YRCkWg3vG+bCEFKH7N8dqSPQoVXrPo66xXEgpGod7xvmwhBSl/zPHakT4KFV6z6OurVhELR5/e8b5tIQUofszx2ZI+CxVes+jrq1cSCkag3fG+bSIFKH7N8dqSPgoUXbPo66tWEQpGn97xvWwhBSh/zfHakj4KFV2z6OurVxIKRqDe8b5sIgUof83w2pI+CxVds+jrq1YRC0af3vG+bCEFKH7N8NmRPQoUX7Tq66pWEQtFn97yvm0hBSh+zPHZkj4LFl6z6OurVhELRaDe8b1sIgUpf83w2pI+CxVds+jrq1YRC0af3vG+bSEFKH7N8NqSPQoVXbPo66xXEgpGoN7xvmwhBSl/zfHakT4KFV2z6OusVxEKRqDe8b5sIgUpf83w2pI+CxVes+jrq1cRCkag3vG+bCIFKH7N8dqSPgoVXbPo66xXEgpGoN7xvm0hBSh+zPHakT4LFF616OurVhILRaDe8b1sIgUpf83w2pI+CxVds+jrq1cSCkag3vG+bCIFKH7N8NmSPgoVXbPo66tWEgtGn97xvWwhBSh+zPHakj4LFF206OurVxIKRqHe8b5sIgUofszu3JI+CxVds+jrq1cSCkag3vG+bSEFKX/N8NmSPQoVXbPo66tXEgpGoN7xvm0hBSh+zPHakj4LFV2z6OurVhIKRqHe8b1sIgUof83w2ZI+CxRds+jrq1YRC0af3vG+bCIFKH7M8dmSPgoVXbPo66xXEQpFn97xvm0hBSh+zfDakj4LFV2z6OurVhELRqDe8b5sIgUofszw2pI+CxRds+jrq1cSCkag3fG+bCEFKH7M8dmSPgsVXbPo66tXEgpGoN7xvmwhBSl/zfHakT4KFV2z6OurVhILRaDe8b5sIgUofszw2pI+CxVds+jrq1YSCkWg3vG+bCIFKH7M8dmSPgoVXbPo66tXEgpGoN7xvm0hBSh+zfDakj4LFV6z6OurVhIKRqHe8b5sIgUpfszw2pI+CxVds+jrq1YRC0af3vG+bSEFKH7N8NqSPQoVXbPo66tWEgtGoN7xvmwhBSl/zfDakj4LFWC06OusVxEKRqHe8b5sIgUofszw2pI+CxVds+jrq1cSCkag3vG+bCIFKH7N8NqSPQoVXbTo66tWEgtGn97xvWwhBSh+zfHakj4LFV2z6OurVhIKRqHe8b5sIgUof83w2pI+CxVes+jrq1cSCkag3vG+bCIFKH7N8NqSPgoVXbPo66xXEgpGoN7xvm0hBSh+zPHakj4LFV2z6OurVhIKRqDe8b1sIgUofszw2pI+CxVds+jrq1YRC0af3vG+bSEFKH7N8NmSPQoVXrPo66pWEQtGod7xvWwhBSh+zfHakj4LFV2z6OurVhELRqHe8b1sIgUofszw2pI+CxVds+jrq1cSCkag3vG+bCIFKH7N8NmSPQoVXbPo66pWEQpGoN7xvmwhBSl/zfDakj4LFV206OurVhIKRqHe8r5tIQUof83w2pI=');
        audio.play().catch(e => console.log('Audio play failed:', e));
      } else {
        throw new Error(response.data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
      setResult({ warnings: [error.message] });
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

        {/* Current Database Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Current Database Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{stats.buildings}</div>
                  <div className="text-sm text-slate-600 mt-1">Buildings</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{stats.floors}</div>
                  <div className="text-sm text-slate-600 mt-1">Floors</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{stats.rooms}</div>
                  <div className="text-sm text-slate-600 mt-1">Rooms</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <div className="text-3xl font-bold text-amber-600">{stats.assets}</div>
                  <div className="text-sm text-slate-600 mt-1">Assets</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">Unable to load stats</p>
            )}
          </CardContent>
        </Card>

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

        {/* Import Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Import Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={importMode === 'all' ? 'default' : 'outline'}
                onClick={() => setImportMode('all')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Database className="w-5 h-5" />
                <div>
                  <div className="font-semibold">All Data</div>
                  <div className="text-xs opacity-80">Floors, Rooms, Assets</div>
                </div>
              </Button>
              <Button
                variant={importMode === 'floors' ? 'default' : 'outline'}
                onClick={() => setImportMode('floors')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Floors Only</div>
                  <div className="text-xs opacity-80">Buildings & Floors</div>
                </div>
              </Button>
              <Button
                variant={importMode === 'rooms' ? 'default' : 'outline'}
                onClick={() => setImportMode('rooms')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Rooms Only</div>
                  <div className="text-xs opacity-80">Room data</div>
                </div>
              </Button>
              <Button
                variant={importMode === 'assets' ? 'default' : 'outline'}
                onClick={() => setImportMode('assets')}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Assets Only</div>
                  <div className="text-xs opacity-80">Asset data</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Export Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(importMode === 'all' || importMode === 'floors') && (
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
            )}

            {(importMode === 'all' || importMode === 'rooms') && (
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
            )}

            {(importMode === 'all' || importMode === 'assets') && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Assets Export(s) - Multiple Files Supported
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    If you split assets by building, upload all files here
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    multiple
                    onChange={(e) => setAssetsFiles(Array.from(e.target.files))}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                  {assetsFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {assetsFiles.map((file, idx) => (
                        <p key={idx} className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {file.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Asset Photos (ZIP) - Optional
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Upload after importing asset data. Process photos separately to avoid CPU limits.
                  </p>
                  <input
                    type="file"
                    accept=".zip"
                    multiple
                    onChange={(e) => setPhotoFiles(Array.from(e.target.files))}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-purple-50 file:text-purple-700
                      hover:file:bg-purple-100"
                  />
                  {photoFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {photoFiles.map((file, idx) => (
                        <p key={idx} className="text-sm text-purple-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {file.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {importMode === 'assets' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Skip Assets (Start at row #)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={skipAssets}
                    onChange={(e) => setSkipAssets(parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Limit (Process # assets)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={limitAssets}
                    onChange={(e) => setLimitAssets(parseInt(e.target.value) || 5)}
                    className="h-9"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">
                    Process assets {skipAssets} to {skipAssets + limitAssets}. Run multiple times with different skip values to import all assets.
                  </p>
                </div>
              </div>
            )}

            {importMode === 'rooms' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Skip Rows (Start at row #)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={skipRows}
                    onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Limit (Process # rows)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={limitRows}
                    onChange={(e) => setLimitRows(parseInt(e.target.value) || 10)}
                    className="h-9"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">
                    Process rows {skipRows} to {skipRows + limitRows}. Run multiple times with different skip values to import all rooms.
                  </p>
                </div>
            </div>
            )}

            <Button
              onClick={handleImport}
              disabled={importing || 
                (importMode === 'all' && (!floorsFile || !roomsFile || assetsFiles.length === 0)) ||
                (importMode === 'floors' && !floorsFile) ||
                (importMode === 'rooms' && !roomsFile) ||
                (importMode === 'assets' && assetsFiles.length === 0)
              }
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

            {importing && importProgress && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">{importProgress}</p>
              <p className="text-xs text-blue-600 mt-1">This may take several minutes...</p>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.warnings?.length > 0 ? (
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

              {result.warnings && result.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-2">
                    Warnings ({result.warnings.length})
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {result.warnings.map((warning, idx) => (
                      <p key={idx} className="text-xs text-amber-800 mb-1">{warning}</p>
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