import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Building2,
  Upload,
  FileText,
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function FloorPlanManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [uploadingFloorId, setUploadingFloorId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [buildingsData, floorsData] = await Promise.all([
        base44.entities.Building.list(),
        base44.entities.Floor.list()
      ]);

      setBuildings(buildingsData);
      setFloors(floorsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (floorId, file) => {
    setUploadingFloorId(floorId);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.entities.Floor.update(floorId, {
        floor_plan_file: file_url
      });

      toast.success('Floor plan uploaded');
      await loadData();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload floor plan');
    } finally {
      setUploadingFloorId(null);
    }
  };

  const groupedFloors = buildings.map(building => ({
    building,
    floors: floors.filter(f => f.building_id === building.id)
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Floor Plan Manager</h1>
              <p className="text-sm text-slate-600">Upload and manage floor plan PDFs for each floor</p>
            </div>
          </div>
        </div>

        {/* Buildings & Floors */}
        <div className="space-y-6">
          {groupedFloors.map(({ building, floors: buildingFloors }) => (
            <Card key={building.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {building.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {buildingFloors.length === 0 ? (
                    <p className="text-sm text-slate-500">No floors found for this building</p>
                  ) : (
                    buildingFloors.map(floor => (
                      <div
                        key={floor.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-slate-900">{floor.name}</h3>
                            {floor.floor_plan_file ? (
                              <Badge className="bg-green-100 text-green-700">
                                <Check className="w-3 h-3 mr-1" />
                                Floor plan uploaded
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 text-amber-700">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                No floor plan
                              </Badge>
                            )}
                          </div>
                          {floor.floor_plan_file && (
                            <a
                              href={floor.floor_plan_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <FileText className="w-3 h-3" />
                              View current floor plan
                            </a>
                          )}
                        </div>

                        <div>
                          <input
                            type="file"
                            id={`upload-${floor.id}`}
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleFileUpload(floor.id, file);
                            }}
                            disabled={uploadingFloorId === floor.id}
                          />
                          <label htmlFor={`upload-${floor.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={uploadingFloorId === floor.id}
                              asChild
                            >
                              <span className="cursor-pointer">
                                {uploadingFloorId === floor.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    {floor.floor_plan_file ? 'Replace' : 'Upload'}
                                  </>
                                )}
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {groupedFloors.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">No buildings or floors found</p>
              <p className="text-sm text-slate-500 mt-1">
                Run the AkitaSync import to populate floor data
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}