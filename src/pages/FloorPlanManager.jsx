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
  AlertCircle,
  Maximize2,
  Eye,
  ArrowUpCircle,
  Plus,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

export default function FloorPlanManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const [pendingPrimaryFile, setPendingPrimaryFile] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showAddAlternate, setShowAddAlternate] = useState(false);
  const [showViewAlternate, setShowViewAlternate] = useState(false);
  const [viewingAlternate, setViewingAlternate] = useState(null);
  const [showPromoteWarning, setShowPromoteWarning] = useState(false);
  const [promotingAlternate, setPromotingAlternate] = useState(null);
  const [newAlternate, setNewAlternate] = useState({
    name: '',
    file: null,
    notes: ''
  });

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

      if (buildingsData.length > 0 && !selectedBuilding) {
        setSelectedBuilding(buildingsData[0]);
        const buildingFloors = floorsData.filter(f => f.building_id === buildingsData[0].id);
        if (buildingFloors.length > 0) {
          setSelectedFloor(buildingFloors[0]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleReplacePrimary = (file) => {
    if (selectedFloor?.primary_floorplan_file) {
      setPendingPrimaryFile(file);
      setShowReplaceWarning(true);
    } else {
      uploadPrimaryFloorplan(file);
    }
  };

  const uploadPrimaryFloorplan = async (file) => {
    setUploadingPrimary(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.entities.Floor.update(selectedFloor.id, {
        primary_floorplan_file: file_url
      });

      toast.success('Primary floor plan uploaded');
      await loadData();
      
      const updatedFloor = floors.find(f => f.id === selectedFloor.id);
      if (updatedFloor) {
        setSelectedFloor({ ...selectedFloor, primary_floorplan_file: file_url });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload floor plan');
    } finally {
      setUploadingPrimary(false);
      setShowReplaceWarning(false);
      setPendingPrimaryFile(null);
    }
  };

  const handleAddAlternate = async () => {
    if (!newAlternate.name || !newAlternate.file) {
      toast.error('Please provide a name and file');
      return;
    }

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: newAlternate.file });
      
      const existingAlternates = selectedFloor.alternate_floorplans || [];
      const updatedAlternates = [
        ...existingAlternates,
        {
          name: newAlternate.name,
          file: file_url,
          notes: newAlternate.notes,
          uploaded_at: new Date().toISOString()
        }
      ];

      await base44.entities.Floor.update(selectedFloor.id, {
        alternate_floorplans: updatedAlternates
      });

      toast.success('Alternate floor plan added');
      setShowAddAlternate(false);
      setNewAlternate({ name: '', file: null, notes: '' });
      await loadData();
      
      const updatedFloor = floors.find(f => f.id === selectedFloor.id);
      if (updatedFloor) {
        setSelectedFloor(updatedFloor);
      }
    } catch (error) {
      console.error('Error adding alternate:', error);
      toast.error('Failed to add alternate floor plan');
    }
  };

  const handlePromoteAlternate = async () => {
    if (!promotingAlternate) return;

    try {
      const alternates = selectedFloor.alternate_floorplans || [];
      const remainingAlternates = alternates.filter(alt => alt.file !== promotingAlternate.file);

      await base44.entities.Floor.update(selectedFloor.id, {
        primary_floorplan_file: promotingAlternate.file,
        alternate_floorplans: remainingAlternates
      });

      toast.success('Alternate promoted to primary');
      setShowPromoteWarning(false);
      setPromotingAlternate(null);
      await loadData();
      
      const updatedFloor = floors.find(f => f.id === selectedFloor.id);
      if (updatedFloor) {
        setSelectedFloor(updatedFloor);
      }
    } catch (error) {
      console.error('Error promoting alternate:', error);
      toast.error('Failed to promote alternate');
    }
  };

  const handleDeleteAlternate = async (alternate) => {
    try {
      const alternates = selectedFloor.alternate_floorplans || [];
      const updatedAlternates = alternates.filter(alt => alt.file !== alternate.file);

      await base44.entities.Floor.update(selectedFloor.id, {
        alternate_floorplans: updatedAlternates
      });

      toast.success('Alternate floor plan deleted');
      await loadData();
      
      const updatedFloor = floors.find(f => f.id === selectedFloor.id);
      if (updatedFloor) {
        setSelectedFloor(updatedFloor);
      }
    } catch (error) {
      console.error('Error deleting alternate:', error);
      toast.error('Failed to delete alternate');
    }
  };

  const buildingFloors = selectedBuilding
    ? floors.filter(f => f.building_id === selectedBuilding.id).sort((a, b) => (a.level_number || 0) - (b.level_number || 0))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white shadow-sm p-4">
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
              <h1 className="text-xl font-bold text-slate-900">Floor Plan Manager</h1>
              <p className="text-xs text-slate-600">Manage primary and alternate floor plans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Buildings & Floors */}
        <div className="w-80 border-r bg-white shadow-sm flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-slate-700 mb-3">Buildings</h3>
              <div className="space-y-2">
                {buildings.map(building => (
                  <Card
                    key={building.id}
                    className={`cursor-pointer transition-all ${
                      selectedBuilding?.id === building.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-blue-300'
                    }`}
                    onClick={() => {
                      setSelectedBuilding(building);
                      const newFloors = floors.filter(f => f.building_id === building.id);
                      if (newFloors.length > 0) {
                        setSelectedFloor(newFloors[0]);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium text-sm">{building.name}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {selectedBuilding && (
              <div>
                <h3 className="font-semibold text-sm text-slate-700 mb-3">Floors</h3>
                <div className="space-y-2">
                  {buildingFloors.map(floor => (
                    <Card
                      key={floor.id}
                      className={`cursor-pointer transition-all ${
                        selectedFloor?.id === floor.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-blue-300'
                      }`}
                      onClick={() => setSelectedFloor(floor)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{floor.name}</span>
                          {floor.primary_floorplan_file && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* CENTER PANEL: Primary Floor Plan */}
        <div className="flex-1 flex flex-col bg-slate-100">
          <div className="border-b bg-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {selectedFloor ? `${selectedFloor.name} - Primary Floor Plan` : 'Select a floor'}
              </h3>
              {selectedFloor?.primary_floorplan_file && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFullscreen(true)}
                  >
                    <Maximize2 className="w-4 h-4 mr-1" />
                    Fullscreen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingPrimary}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('replace-primary').click();
                    }}
                  >
                    {uploadingPrimary ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-1" />
                        Replace Primary
                      </>
                    )}
                  </Button>
                  <input
                    type="file"
                    id="replace-primary"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      e.preventDefault();
                      const file = e.target.files?.[0];
                      if (file) {
                        handleReplacePrimary(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {selectedFloor ? (
              selectedFloor.primary_floorplan_file ? (
                <FloorplanViewer imageUrl={selectedFloor.primary_floorplan_file} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Card className="max-w-md">
                    <CardContent className="py-12 text-center">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-600 font-medium mb-2">No primary floor plan</p>
                      <p className="text-sm text-slate-500 mb-4">
                        Upload a primary floor plan for {selectedFloor.name}
                      </p>
                      <Button 
                        disabled={uploadingPrimary}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('upload-primary').click();
                        }}
                      >
                        {uploadingPrimary ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Primary
                          </>
                        )}
                      </Button>
                      <input
                        type="file"
                        id="upload-primary"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          e.preventDefault();
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadPrimaryFloorplan(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a floor to view floor plan</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Alternate Floor Plans */}
        <div className="w-80 border-l bg-white shadow-sm flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Alternate Floor Plans</h3>
              {selectedFloor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAlternate(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {selectedFloor ? (
              (selectedFloor.alternate_floorplans || []).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">No alternate floor plans</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(selectedFloor.alternate_floorplans || []).map((alternate, idx) => (
                    <Card key={idx} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{alternate.name}</p>
                            {alternate.notes && (
                              <p className="text-xs text-slate-500 mt-1">{alternate.notes}</p>
                            )}
                            {alternate.uploaded_at && (
                              <p className="text-xs text-slate-400 mt-1">
                                {format(new Date(alternate.uploaded_at), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setViewingAlternate(alternate);
                              setShowViewAlternate(true);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setPromotingAlternate(alternate);
                              setShowPromoteWarning(true);
                            }}
                          >
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            Promote
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAlternate(alternate)}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12 text-slate-400">
                <p className="text-sm">Select a floor</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Replace Primary Warning Dialog */}
      <AlertDialog open={showReplaceWarning} onOpenChange={setShowReplaceWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Primary Floor Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the primary floor plan for {selectedFloor?.name}. Asset pin coordinates will NOT be modified - they use normalized coordinates (0-1) that are independent of the floor plan image.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingPrimaryFile(null);
              setShowReplaceWarning(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => uploadPrimaryFloorplan(pendingPrimaryFile)}>
              Replace Primary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote Alternate Warning Dialog */}
      <AlertDialog open={showPromoteWarning} onOpenChange={setShowPromoteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Primary?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current primary floor plan with "{promotingAlternate?.name}". Asset pin coordinates will NOT be modified. The alternate will be removed from the list after promotion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPromotingAlternate(null);
              setShowPromoteWarning(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteAlternate}>
              Promote to Primary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Alternate Dialog */}
      <Dialog open={showAddAlternate} onOpenChange={setShowAddAlternate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Alternate Floor Plan</DialogTitle>
            <DialogDescription>
              Upload an alternate floor plan (HVAC, Electrical, Legacy, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Name (e.g., HVAC, Electrical)"
              value={newAlternate.name}
              onChange={(e) => setNewAlternate({ ...newAlternate, name: e.target.value })}
            />
            <div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('alternate-file').click();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {newAlternate.file ? newAlternate.file.name : 'Choose File'}
              </Button>
              <input
                type="file"
                id="alternate-file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  e.preventDefault();
                  const file = e.target.files?.[0];
                  if (file) {
                    setNewAlternate({ ...newAlternate, file });
                  }
                  e.target.value = '';
                }}
              />
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={newAlternate.notes}
              onChange={(e) => setNewAlternate({ ...newAlternate, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddAlternate(false);
              setNewAlternate({ name: '', file: null, notes: '' });
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddAlternate}>Add Alternate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Alternate Dialog */}
      <Dialog open={showViewAlternate} onOpenChange={setShowViewAlternate}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingAlternate?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {viewingAlternate && <FloorplanViewer imageUrl={viewingAlternate.file} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-7xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedFloor?.name} - Primary Floor Plan</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedFloor?.primary_floorplan_file && (
              <FloorplanViewer imageUrl={selectedFloor.primary_floorplan_file} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FloorplanViewer({ imageUrl }) {
  const isPdf = imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.includes('pdf');

  return (
    <div className="w-full h-full flex items-center justify-center bg-white rounded-lg shadow-inner">
      {isPdf ? (
        <iframe
          src={imageUrl}
          className="w-full h-full border-0"
          title="Floor plan PDF"
        />
      ) : (
        <img
          src={imageUrl}
          alt="Floor plan"
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
          onError={(e) => {
            console.error('Image failed to load:', imageUrl);
            e.target.alt = 'Failed to load floor plan';
          }}
        />
      )}
    </div>
  );
}