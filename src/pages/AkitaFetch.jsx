import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Building2,
  Layers,
  Package,
  Search,
  MapPin,
  Loader2,
  Filter,
  ExternalLink,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function AkitaFetch() {
  const navigate = useNavigate();
  
  // Data state
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetGroups, setAssetGroups] = useState([]);
  
  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showPins, setShowPins] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Active");

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [buildingsData, floorsData, assetsData, groupsData] = await Promise.all([
        base44.entities.Building.list(),
        base44.entities.Floor.list(),
        base44.entities.Asset.list(),
        base44.entities.AssetGroup.list()
      ]);

      setBuildings(buildingsData);
      setFloors(floorsData);
      setAssets(assetsData);
      setAssetGroups(groupsData);

      // Auto-select first building and floor
      if (buildingsData.length > 0) {
        setSelectedBuilding(buildingsData[0]);
        const buildingFloors = floorsData.filter(f => f.building_id === buildingsData[0].id);
        if (buildingFloors.length > 0) {
          setSelectedFloor(buildingFloors[0]);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load facility data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetClick = (asset) => {
    setSelectedAsset(asset);
  };

  // Get floors for selected building
  const buildingFloors = useMemo(() => {
    if (!selectedBuilding) return [];
    return floors.filter(f => f.building_id === selectedBuilding.id)
      .sort((a, b) => (a.level_number || 0) - (b.level_number || 0));
  }, [selectedBuilding, floors]);

  // Asset filtering
  const filteredAssets = useMemo(() => {
    if (!selectedBuilding || !selectedFloor) return [];
    
    return assets.filter(asset => {
      // Floor filter
      if (asset.floor_id !== selectedFloor.id) return false;
      
      // Status filter
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      
      // Group filter
      if (groupFilter !== "all") {
        const assetGroup = assetGroups.find(g => g.id === asset.asset_group_id);
        if (assetGroup?.name !== groupFilter) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${asset.name} ${asset.model || ''} ${asset.serial_number || ''} ${asset.room_number || ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      
      return true;
    });
  }, [assets, selectedBuilding, selectedFloor, groupFilter, statusFilter, searchQuery, assetGroups]);

  const floorplanImage = selectedFloor?.primary_floorplan_file || selectedFloor?.floor_plan_file || null;

  // Get asset stats
  const assetStats = useMemo(() => {
    if (!selectedBuilding) return { total: 0, byFloor: 0 };
    const buildingAssets = assets.filter(a => a.building_id === selectedBuilding.id);
    const floorAssets = selectedFloor ? buildingAssets.filter(a => a.floor_id === selectedFloor.id) : [];
    return {
      total: buildingAssets.length,
      byFloor: floorAssets.length
    };
  }, [selectedBuilding, selectedFloor, assets]);

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
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">AkitaFetch</h1>
                <p className="text-xs text-slate-600">Facility Browser & Asset Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL 1: Buildings & Floors */}
        <div className="w-80 border-r bg-white shadow-sm flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {/* Buildings */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-sm text-slate-700">Buildings</h3>
              </div>
              <div className="space-y-2">
                {loading && buildings.length === 0 ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : buildings.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No buildings found. Run AkitaSync import first.
                  </p>
                ) : (
                  buildings.map(building => {
                    const buildingAssetCount = assets.filter(a => a.building_id === building.id).length;
                    return (
                      <motion.div
                        key={building.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
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
                            } else {
                              setSelectedFloor(null);
                            }
                            setSelectedAsset(null);
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="font-medium text-sm">{building.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {building.address && (
                                <div className="text-xs text-slate-500">{building.address}</div>
                              )}
                              <Badge variant="outline" className="text-xs ml-auto">
                                {buildingAssetCount} assets
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Floors */}
            {selectedBuilding && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Floors</h3>
                </div>
                <div className="space-y-2">
                  {buildingFloors.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-2">No floors found</p>
                  ) : (
                    buildingFloors.map(floor => {
                      const floorAssetCount = assets.filter(a => a.floor_id === floor.id).length;
                      return (
                        <motion.div
                          key={floor.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card
                            className={`cursor-pointer transition-all ${
                              selectedFloor?.id === floor.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:border-blue-300'
                            }`}
                            onClick={() => {
                              setSelectedFloor(floor);
                              setSelectedAsset(null);
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{floor.name}</div>
                                <div className="flex items-center gap-2">
                                  {floor.level_number && (
                                    <Badge variant="outline" className="text-xs">
                                      L{floor.level_number}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {floorAssetCount}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* PANEL 2: Floorplan Viewer */}
        <div className="flex-1 flex flex-col bg-slate-100">
          <div className="border-b bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-sm">
                  {selectedFloor ? `${selectedFloor.name} - Floor Plan` : 'Select a floor'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedFloor && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPins(!showPins)}
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      {showPins ? 'Hide' : 'Show'} Pins
                    </Button>
                    <Badge variant="outline">
                      {assetStats.byFloor} assets
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {selectedFloor ? (
              floorplanImage ? (
                <FloorplanCanvas
                  imageUrl={floorplanImage}
                  assets={filteredAssets}
                  selectedAsset={selectedAsset}
                  onAssetClick={handleAssetClick}
                  showPins={showPins}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Card className="max-w-md">
                    <CardContent className="py-12 text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-600 font-medium mb-2">No floor plan available</p>
                      <p className="text-sm text-slate-500 mb-4">
                        Upload a floor plan PDF for {selectedFloor.name}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => navigate(createPageUrl('FloorPlanManager'))}
                      >
                        Upload Floor Plans
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a building and floor to view floor plan</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: Assets List & Details */}
        <div className="w-96 border-l bg-white shadow-sm flex flex-col">
          {/* Search & Filters */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-600" />
              <h3 className="font-semibold text-sm">Assets</h3>
              <Badge variant="secondary" className="ml-auto">
                {filteredAssets.length}
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, model, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {assetGroups.map(group => (
                    <SelectItem key={group.id} value={group.name}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Decommissioned">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Asset List */}
          <ScrollArea className="flex-1 p-4">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {!selectedFloor ? 'Select a floor to view assets' : 'No assets found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map(asset => {
                  const assetGroup = assetGroups.find(g => g.id === asset.asset_group_id);
                  return (
                    <motion.div
                      key={asset.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all ${
                          selectedAsset?.id === asset.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-blue-300'
                        }`}
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <CardContent className="p-3">
                          <div className="font-medium text-sm">{asset.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {assetGroup && (
                              <Badge variant="outline" className="text-xs">
                                {assetGroup.name}
                              </Badge>
                            )}
                            {asset.room_number && (
                              <span className="text-xs text-slate-500">
                                Room {asset.room_number}
                              </span>
                            )}
                          </div>
                          {asset.x_coord !== null && asset.y_coord !== null ? (
                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              On floor plan
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 mt-1">No location</div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Asset Details */}
          {selectedAsset && (
            <div className="border-t p-4 bg-slate-50 max-h-96 overflow-y-auto">
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">{selectedAsset.name}</h4>
                  {selectedAsset.asset_category && (
                    <Badge variant="outline">{selectedAsset.asset_category}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {selectedAsset.building_name && (
                    <div>
                      <span className="font-medium text-slate-600">Building</span>
                      <div className="mt-1">{selectedAsset.building_name}</div>
                    </div>
                  )}
                  {selectedAsset.floor_name && (
                    <div>
                      <span className="font-medium text-slate-600">Floor</span>
                      <div className="mt-1">{selectedAsset.floor_name}</div>
                    </div>
                  )}
                  {selectedAsset.room_number && (
                    <div>
                      <span className="font-medium text-slate-600">Room</span>
                      <div className="mt-1">
                        {selectedAsset.room_number}
                        {selectedAsset.room_name && ` - ${selectedAsset.room_name}`}
                      </div>
                    </div>
                  )}
                  {selectedAsset.manufacturer && (
                    <div>
                      <span className="font-medium text-slate-600">Manufacturer</span>
                      <div className="mt-1">{selectedAsset.manufacturer}</div>
                    </div>
                  )}
                  {selectedAsset.model && (
                    <div>
                      <span className="font-medium text-slate-600">Model</span>
                      <div className="mt-1">{selectedAsset.model}</div>
                    </div>
                  )}
                  {selectedAsset.serial_number && (
                    <div>
                      <span className="font-medium text-slate-600">Serial</span>
                      <div className="mt-1">{selectedAsset.serial_number}</div>
                    </div>
                  )}
                  {selectedAsset.condition && (
                    <div>
                      <span className="font-medium text-slate-600">Condition</span>
                      <div className="mt-1">{selectedAsset.condition}</div>
                    </div>
                  )}
                  {selectedAsset.installation_date && (
                    <div>
                      <span className="font-medium text-slate-600">Installed</span>
                      <div className="mt-1">{selectedAsset.installation_date}</div>
                    </div>
                  )}
                </div>

                {selectedAsset.description && (
                  <div>
                    <span className="font-medium text-slate-600 text-xs">Description</span>
                    <p className="text-xs text-slate-700 mt-1">{selectedAsset.description}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <span className="font-medium text-slate-600 text-xs">Floor Plan Location</span>
                  <div className="text-xs text-slate-700 mt-1">
                    {selectedAsset.x_coord !== null && selectedAsset.y_coord !== null
                      ? `X: ${(selectedAsset.x_coord * 100).toFixed(1)}%, Y: ${(selectedAsset.y_coord * 100).toFixed(1)}%`
                      : 'No coordinates set'}
                  </div>
                </div>

                {selectedAsset.akita_url && (
                  <a
                    href={selectedAsset.akita_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="w-3 h-3 mr-2" />
                      View in AkitaBox
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
          </div>
          </div>
          </div>
          );
          }

// Floorplan Canvas Component
function FloorplanCanvas({ imageUrl, assets, selectedAsset, onAssetClick, showPins }) {
  const isPdf = imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.includes('pdf');

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white rounded-lg shadow-inner">
      {isPdf ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8">
          <FileText className="w-16 h-16 mb-4 text-slate-400" />
          <p className="mb-2 font-medium text-lg">PDF Floor Plan</p>
          <p className="text-sm text-slate-500 text-center max-w-md">
            This floor has a PDF floor plan. Asset pins cannot be displayed on PDF floor plans. Upload an image version for visual asset mapping.
          </p>
        </div>
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

      {/* Asset Pins Overlay */}
      {showPins && (
        <div className="absolute inset-0 pointer-events-none">
          {assets.map(asset => {
            if (asset.x_coord === null || asset.y_coord === null) return null;

            const isSelected = selectedAsset?.id === asset.id;
            
            // Convert 0-1 normalized coords to percentage
            const xPercent = asset.x_coord * 100;
            const yPercent = asset.y_coord * 100;

            return (
              <motion.div
                key={asset.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.3 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAssetClick(asset);
                }}
              >
                <div
                  className={`w-4 h-4 rounded-full cursor-pointer shadow-lg transition-all ${
                    isSelected
                      ? 'bg-blue-500 ring-4 ring-blue-300'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                  title={asset.name}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}