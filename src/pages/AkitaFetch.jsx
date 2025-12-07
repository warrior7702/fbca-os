import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Building2,
  Layers,
  DoorOpen,
  Package,
  Search,
  MapPin,
  Edit3,
  Check,
  X,
  Loader2,
  Filter
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
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function AkitaFetch() {
  const navigate = useNavigate();
  
  // Data state
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assets, setAssets] = useState([]);
  
  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [error, setError] = useState(null);

  // Load buildings on mount
  useEffect(() => {
    loadBuildings();
  }, []);

  // Load floors when building changes
  useEffect(() => {
    if (selectedBuilding) {
      loadFloors(selectedBuilding.id);
    } else {
      setFloors([]);
      setSelectedFloor(null);
    }
  }, [selectedBuilding]);

  // Load rooms and assets when floor changes
  useEffect(() => {
    if (selectedFloor && selectedBuilding) {
      loadRoomsAndAssets(selectedBuilding.id, selectedFloor.id);
    } else {
      setRooms([]);
      setAssets([]);
    }
  }, [selectedFloor, selectedBuilding]);

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'buildings'
      });
      
      if (response.data?.success && response.data?.data?.buildings) {
        setBuildings(response.data.data.buildings);
      } else {
        throw new Error('Failed to load buildings');
      }
    } catch (err) {
      console.error('Error loading buildings:', err);
      setError(err.message);
      toast.error('Failed to load buildings');
    } finally {
      setLoading(false);
    }
  };

  const loadFloors = async (buildingId) => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'levels',
        buildingId
      });
      
      if (response.data?.success && response.data?.data?.levels) {
        const sortedLevels = response.data.data.levels.sort((a, b) => (a.order || 0) - (b.order || 0));
        setFloors(sortedLevels);
        if (sortedLevels.length > 0) {
          setSelectedFloor(sortedLevels[0]);
        }
      }
    } catch (err) {
      console.error('Error loading floors:', err);
      toast.error('Failed to load floors');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomsAndAssets = async (buildingId, levelId) => {
    setLoading(true);
    try {
      const [roomsResponse, assetsResponse] = await Promise.all([
        base44.functions.invoke('getAkitaBoxData', {
          type: 'rooms',
          buildingId,
          levelId
        }),
        base44.functions.invoke('getAkitaBoxData', {
          type: 'assets',
          buildingId,
          levelId
        })
      ]);

      if (roomsResponse.data?.success && roomsResponse.data?.data?.rooms) {
        setRooms(roomsResponse.data.data.rooms);
      }

      if (assetsResponse.data?.success && assetsResponse.data?.data?.assets) {
        const assetsData = assetsResponse.data.data.assets.map(asset => ({
          id: asset._id || asset.id,
          name: asset.name || asset.displayName || 'Unnamed Asset',
          group: asset.pinType?.name || asset.asset_group || null,
          buildingId,
          levelId,
          roomId: asset.room?._id || null,
          fields: asset.values || {},
          floorplan: {
            x: asset.percentX || null,
            y: asset.percentY || null
          }
        }));
        setAssets(assetsData);
      }
    } catch (err) {
      console.error('Error loading rooms/assets:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePinClick = async (x, y) => {
    if (!editMode || !selectedAsset) return;

    try {
      // Save pin location to Base44
      const existingPins = await base44.entities.AkitaPin.filter({
        asset_id: selectedAsset.id,
        level_id: selectedFloor.id
      });

      const pinData = {
        asset_id: selectedAsset.id,
        level_id: selectedFloor.id,
        document_id: selectedFloor.document?.id || null,
        x,
        y,
        updated_by: (await base44.auth.me()).id
      };

      if (existingPins.length > 0) {
        await base44.entities.AkitaPin.update(existingPins[0].id, pinData);
      } else {
        await base44.entities.AkitaPin.create(pinData);
      }

      // Update local state
      setAssets(prev => prev.map(a => 
        a.id === selectedAsset.id 
          ? { ...a, floorplan: { x, y } }
          : a
      ));

      toast.success('Pin location updated');
    } catch (err) {
      console.error('Error updating pin:', err);
      toast.error('Failed to update pin location');
    }
  };

  // Asset filtering
  const assetGroups = useMemo(() => {
    const groups = new Set(assets.map(a => a.group).filter(Boolean));
    return Array.from(groups);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Group filter
      if (groupFilter !== "all" && asset.group !== groupFilter) return false;
      
      // Room filter
      if (selectedRoom && asset.roomId !== selectedRoom.id) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${asset.name} ${asset.group || ''} ${JSON.stringify(asset.fields)}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      
      return true;
    });
  }, [assets, groupFilter, selectedRoom, searchQuery]);

  const floorplanImage = selectedFloor?.document?.public_thumbnail_url_display ||
                        selectedFloor?.document?.public_thumbnail_url_large ||
                        selectedFloor?.document?.public_thumbnail_url_medium ||
                        selectedFloor?.document?.public_url ||
                        null;

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white shadow-sm p-4">
        <div className="flex items-center justify-between max-w-full">
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

          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className={editMode ? "bg-blue-600" : ""}
            >
              {editMode ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Edit Mode ON
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Pins
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL 1: Navigation (Buildings → Floors → Rooms) */}
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
                ) : (
                  buildings.map(building => (
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
                          setSelectedRoom(null);
                          setSelectedAsset(null);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="font-medium text-sm">{building.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{building.address}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Floors */}
            {selectedBuilding && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Floors</h3>
                </div>
                <div className="space-y-2">
                  {floors.map(floor => (
                    <motion.div
                      key={floor._id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all ${
                          selectedFloor?._id === floor._id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-blue-300'
                        }`}
                        onClick={() => {
                          setSelectedFloor(floor);
                          setSelectedRoom(null);
                          setSelectedAsset(null);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{floor.name}</div>
                            <Badge variant="outline" className="text-xs">
                              {floor.order || 0}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Rooms */}
            {selectedFloor && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DoorOpen className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Rooms</h3>
                  {selectedRoom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRoom(null)}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {rooms.map(room => (
                    <div
                      key={room._id}
                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                        selectedRoom?._id === room._id
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-slate-100'
                      }`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className="font-medium">{room.number || room.name}</div>
                      {room.number && room.name && (
                        <div className="text-xs text-slate-500">{room.name}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* PANEL 2: Floorplan Canvas */}
        <div className="flex-1 flex flex-col bg-slate-100">
          <div className="border-b bg-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-600" />
              <h3 className="font-semibold text-sm">
                {selectedFloor ? `${selectedFloor.name} Floorplan` : 'Select a floor'}
              </h3>
            </div>
            {editMode && selectedAsset && (
              <Badge className="bg-amber-500">
                Click floorplan to place pin for: {selectedAsset.name}
              </Badge>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {floorplanImage ? (
              <FloorplanCanvas
                imageUrl={floorplanImage}
                assets={filteredAssets}
                selectedAsset={selectedAsset}
                editMode={editMode}
                onPinClick={handlePinClick}
                onAssetClick={(asset) => setSelectedAsset(asset)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No floorplan available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: Assets */}
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
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {assetGroups.map(group => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asset List */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {filteredAssets.map(asset => (
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {asset.name}
                          </div>
                          {asset.group && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {asset.group}
                            </Badge>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {asset.floorplan.x && asset.floorplan.y ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Pin: {asset.floorplan.x.toFixed(1)}%, {asset.floorplan.y.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-amber-600">No pin placed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Asset Details */}
          {selectedAsset && (
            <div className="border-t p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">Asset Details</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAsset(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-slate-600">Name:</span>
                  <div className="mt-1">{selectedAsset.name}</div>
                </div>
                
                {selectedAsset.group && (
                  <div>
                    <span className="font-medium text-slate-600">Group:</span>
                    <div className="mt-1">{selectedAsset.group}</div>
                  </div>
                )}

                {rooms.find(r => r._id === selectedAsset.roomId) && (
                  <div>
                    <span className="font-medium text-slate-600">Room:</span>
                    <div className="mt-1">
                      {rooms.find(r => r._id === selectedAsset.roomId)?.number || 
                       rooms.find(r => r._id === selectedAsset.roomId)?.name}
                    </div>
                  </div>
                )}

                <div>
                  <span className="font-medium text-slate-600">Coordinates:</span>
                  <div className="mt-1">
                    {selectedAsset.floorplan.x && selectedAsset.floorplan.y
                      ? `X: ${selectedAsset.floorplan.x.toFixed(2)}%, Y: ${selectedAsset.floorplan.y.toFixed(2)}%`
                      : 'Not placed'}
                  </div>
                </div>

                {Object.keys(selectedAsset.fields).length > 0 && (
                  <div>
                    <span className="font-medium text-slate-600">Fields:</span>
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(selectedAsset.fields).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="font-medium">{key}:</span>{' '}
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <Edit3 className="w-3 h-3 mr-2" />
                  Edit Pin Location
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="absolute bottom-4 right-4 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

// Floorplan Canvas Component
function FloorplanCanvas({ imageUrl, assets, selectedAsset, editMode, onPinClick, onAssetClick }) {
  const canvasRef = React.useRef(null);

  const handleCanvasClick = (e) => {
    if (!editMode || !selectedAsset) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    onPinClick(x, y);
  };

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full flex items-center justify-center bg-white rounded-lg shadow-inner"
      style={{ cursor: editMode && selectedAsset ? 'crosshair' : 'default' }}
      onClick={handleCanvasClick}
    >
      <img
        src={imageUrl}
        alt="Floorplan"
        className="max-w-full max-h-full object-contain select-none"
        draggable={false}
      />

      {/* Pin Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {assets.map(asset => {
          if (!asset.floorplan.x || !asset.floorplan.y) return null;

          const isSelected = selectedAsset?.id === asset.id;

          return (
            <motion.div
              key={asset.id}
              className="absolute pointer-events-auto"
              style={{
                left: `${asset.floorplan.x}%`,
                top: `${asset.floorplan.y}%`,
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
    </div>
  );
}