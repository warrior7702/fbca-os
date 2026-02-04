import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CleaningZoneImport() {
  const [loading, setLoading] = useState(false);
  const [zonesResult, setZonesResult] = useState(null);
  const [mappingsResult, setMappingsResult] = useState(null);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      data.push(obj);
    }
    
    return data;
  };

  const handleZonesImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const zones = parseCSV(text);

      const { data } = await base44.functions.invoke('importCleaningZones', { zones });
      
      setZonesResult(data);
      toast.success(`Imported ${data.imported_count} cleaning zones`);
    } catch (error) {
      console.error('Zones import error:', error);
      toast.error('Failed to import zones: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingsImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const mappings = parseCSV(text);

      const { data } = await base44.functions.invoke('importRoomZoneMappings', { mappings });
      
      setMappingsResult(data);
      toast.success(`Updated ${data.updated_count} rooms`);
      
      if (data.not_found_count > 0) {
        toast.warning(`${data.not_found_count} rooms not found in database`);
      }
    } catch (error) {
      console.error('Mappings import error:', error);
      toast.error('Failed to import mappings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Phase 1: Cleaning Zone Import
          </h1>
          <p className="text-slate-600">
            Import cleaning zones and room zone mappings
          </p>
        </div>

        {/* Step 1: Import Zones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Step 1: Import Cleaning Zones
              {zonesResult && <CheckCircle className="w-5 h-5 text-green-600" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload <code className="bg-slate-100 px-2 py-1 rounded">cleaning_zones_final.csv</code>
            </p>
            
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleZonesImport}
                disabled={loading}
                className="hidden"
              />
              <Button disabled={loading} className="cursor-pointer" asChild>
                <span>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload Zones CSV
                </span>
              </Button>
            </label>

            {zonesResult && (
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  Successfully imported {zonesResult.imported_count} cleaning zones
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Import Room Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Step 2: Import Room Zone Mappings
              {mappingsResult && <CheckCircle className="w-5 h-5 text-green-600" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload <code className="bg-slate-100 px-2 py-1 rounded">room_zone_mapping.csv</code>
            </p>
            
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleMappingsImport}
                disabled={loading || !zonesResult}
                className="hidden"
              />
              <Button 
                disabled={loading || !zonesResult} 
                className="cursor-pointer"
                variant={!zonesResult ? "outline" : "default"}
                asChild
              >
                <span>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload Mappings CSV
                </span>
              </Button>
            </label>

            {!zonesResult && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Please import zones first (Step 1)
                </AlertDescription>
              </Alert>
            )}

            {mappingsResult && (
              <div className="space-y-2">
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Import Complete</div>
                    <div className="text-sm space-y-1">
                      <div>✓ Updated: {mappingsResult.updated_count} rooms</div>
                      {mappingsResult.not_found_count > 0 && (
                        <div className="text-amber-600">
                          ⚠ Not found: {mappingsResult.not_found_count} rooms
                        </div>
                      )}
                      {mappingsResult.error_count > 0 && (
                        <div className="text-red-600">
                          ✗ Errors: {mappingsResult.error_count} rooms
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {mappingsResult.not_found && mappingsResult.not_found.length > 0 && (
                  <details className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <summary className="cursor-pointer font-medium text-sm text-amber-900">
                      View Not Found Rooms ({mappingsResult.not_found.length})
                    </summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {mappingsResult.not_found.slice(0, 10).map((room, idx) => (
                        <div key={idx} className="text-amber-800">
                          {room.room_number} - {room.room_name} (ID: {room.akita_room_id})
                        </div>
                      ))}
                      {mappingsResult.not_found.length > 10 && (
                        <div className="text-amber-600 italic">
                          ... and {mappingsResult.not_found.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification */}
        {mappingsResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Phase 1 Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Schema changes and data import completed. Ready for Phase 2.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 p-3 rounded">
                  <div className="font-semibold text-slate-900">Cleaning Zones</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {zonesResult.imported_count}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="font-semibold text-slate-900">Rooms Updated</div>
                  <div className="text-2xl font-bold text-green-600">
                    {mappingsResult.updated_count}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}