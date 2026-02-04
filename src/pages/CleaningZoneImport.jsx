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
  const [diagnostic, setDiagnostic] = useState(null);

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

      // Run diagnostic after import
      runDiagnostic();
    } catch (error) {
      console.error('Mappings import error:', error);
      toast.error('Failed to import mappings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async () => {
    try {
      const { data } = await base44.functions.invoke('diagnosticRoomData', {});
      setDiagnostic(data);
    } catch (error) {
      console.error('Diagnostic error:', error);
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

        {/* Diagnostics & Auto-Assign */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Auto-Assign Remaining Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Automatically assign cleaning schedules to unassigned rooms based on room name keywords
            </p>
            <div className="flex gap-2">
              <Button onClick={runDiagnostic} disabled={loading} variant="outline">
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Run Diagnostic Check
              </Button>
              <Button onClick={handleAutoAssign} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Auto-Assign Unassigned Rooms
              </Button>
            </div>
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
                disabled={loading}
                className="hidden"
              />
              <Button 
                disabled={loading} 
                className="cursor-pointer"
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

                {mappingsResult.errors && mappingsResult.errors.length > 0 && (
                  <details className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <summary className="cursor-pointer font-medium text-sm text-red-900">
                      View Errors ({mappingsResult.errors.length})
                    </summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {mappingsResult.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="text-red-800">
                          {err.akita_room_id}: {err.error}
                        </div>
                      ))}
                      {mappingsResult.errors.length > 10 && (
                        <div className="text-red-600 italic">
                          ... and {mappingsResult.errors.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnostics */}
        {diagnostic && (
          <Card>
            <CardHeader>
              <CardTitle>Database Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-50 p-3 rounded">
                  <div className="font-semibold text-slate-900">Total Rooms</div>
                  <div className="text-2xl font-bold text-slate-700">
                    {diagnostic.total_rooms}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="font-semibold text-slate-900">Total Zones</div>
                  <div className="text-2xl font-bold text-slate-700">
                    {diagnostic.total_zones}
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="font-semibold text-green-900">With Schedule</div>
                  <div className="text-2xl font-bold text-green-700">
                    {diagnostic.rooms_with_schedule}
                  </div>
                </div>
                <div className="bg-amber-50 p-3 rounded">
                  <div className="font-semibold text-amber-900">Without Schedule</div>
                  <div className="text-2xl font-bold text-amber-700">
                    {diagnostic.rooms_without_schedule}
                  </div>
                </div>
              </div>

              {/* Last Import Results */}
              {mappingsResult && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold text-sm mb-2">Last Import Results</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div className="bg-green-50 p-3 rounded">
                      <div className="font-semibold text-green-900">Updated</div>
                      <div className="text-2xl font-bold text-green-700">
                        {mappingsResult.updated_count}
                      </div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded">
                      <div className="font-semibold text-amber-900">Not Found</div>
                      <div className="text-2xl font-bold text-amber-700">
                        {mappingsResult.not_found_count}
                      </div>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <div className="font-semibold text-red-900">Errors</div>
                      <div className="text-2xl font-bold text-red-700">
                        {mappingsResult.error_count}
                      </div>
                    </div>
                  </div>

                  {mappingsResult.not_found && mappingsResult.not_found.length > 0 && (
                    <details className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
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

                  {mappingsResult.errors && mappingsResult.errors.length > 0 && (
                    <details className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <summary className="cursor-pointer font-medium text-sm text-red-900">
                        View Errors ({mappingsResult.errors.length})
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {mappingsResult.errors.slice(0, 10).map((err, idx) => (
                          <div key={idx} className="text-red-800">
                            {err.akita_room_id}: {err.error}
                          </div>
                        ))}
                        {mappingsResult.errors.length > 10 && (
                          <div className="text-red-600 italic">
                            ... and {mappingsResult.errors.length - 10} more
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2">Rooms by Cleaning Schedule</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(diagnostic.rooms_by_schedule).map(([schedule, count]) => (
                    <div key={schedule} className="flex justify-between">
                      <span className="text-slate-600">{schedule}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Zones by Category</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(diagnostic.zones_by_category).map(([category, count]) => (
                    <div key={category} className="flex justify-between">
                      <span className="text-slate-600">{category}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {diagnostic.rooms_without_schedule_list && diagnostic.rooms_without_schedule_list.length > 0 && (
                <details className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <summary className="cursor-pointer font-medium text-sm text-amber-900">
                    Rooms Without Schedules ({diagnostic.rooms_without_schedule_list.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs max-h-96 overflow-y-auto">
                    {diagnostic.rooms_without_schedule_list.map((room, idx) => (
                      <div key={idx} className="text-amber-800 border-b border-amber-200 pb-1">
                        <strong>{room.room_number}</strong> - {room.room_name} 
                        {room.building && ` | ${room.building}`}
                        {room.floor && ` - ${room.floor}`}
                        <div className="text-xs text-amber-600">Akita ID: {room.akita_room_id}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-sm">
                  Sample Room Data (first 10)
                </summary>
                <div className="mt-2 space-y-2 text-xs">
                  {diagnostic.sample_rooms.map((room, idx) => (
                    <div key={idx} className="border-b border-slate-200 pb-2">
                      <div><strong>Room:</strong> {room.room_number} - {room.room_name}</div>
                      <div><strong>Akita ID:</strong> {room.akita_room_id || 'MISSING'}</div>
                      <div><strong>Zone:</strong> {room.zone_id || 'unassigned'}</div>
                      <div><strong>Schedule:</strong> {room.cleaning_schedule || 'unassigned'}</div>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        )}

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