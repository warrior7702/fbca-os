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
  FileText,
  Ticket,
  X
} from "lucide-react";
import { toast } from "sonner";
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

export default function AkitaFetch() {
  const navigate = useNavigate();
  
  // Data state
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetGroups, setAssetGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  
  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showPins, setShowPins] = useState(true);
  const [showRoomLabels, setShowRoomLabels] = useState(false);
  const [showOnlyWithTickets, setShowOnlyWithTickets] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [roomFilter, setRoomFilter] = useState("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [buildingsData, floorsData, assetsData, groupsData, roomsData, ticketsData] = await Promise.all([
        base44.entities.Building.list(),
        base44.entities.Floor.list(),
        base44.entities.Asset.list(),
        base44.entities.AssetGroup.list(),
        base44.entities.Room.list(),
        base44.entities.Ticket.list()
      ]);

      setBuildings(buildingsData);
      setFloors(floorsData);
      setAssets(assetsData);
      setAssetGroups(groupsData);
      setRooms(roomsData);
      setTickets(ticketsData);

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

  // Get rooms for selected floor
  const floorRooms = useMemo(() => {
    if (!selectedFloor) return [];
    return rooms.filter(r => r.floor_id === selectedFloor.id).sort((a, b) => {
      const aNum = a.room_number || '';
      const bNum = b.room_number || '';
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    });
  }, [selectedFloor, rooms]);

  // Calculate asset counts per room
  const roomAssetCounts = useMemo(() => {
    const counts = {};
    assets.forEach(asset => {
      if (asset.floor_id === selectedFloor?.id) {
        const roomId = asset.room_id || 'unassigned';
        counts[roomId] = (counts[roomId] || 0) + 1;
      }
    });
    return counts;
  }, [assets, selectedFloor]);

  // Calculate open tickets per room and asset
  const openTicketsByRoom = useMemo(() => {
    const roomTickets = {};
    const assetTickets = {};

    // Filter for open tickets only - specific statuses
    const openStatuses = ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'];
    const openTickets = tickets.filter(t => 
      openStatuses.includes(t.status)
    );

    openTickets.forEach(ticket => {
      // Track by room
      if (ticket.room_id) {
        if (!roomTickets[ticket.room_id]) {
          roomTickets[ticket.room_id] = [];
        }
        roomTickets[ticket.room_id].push(ticket);
      }

      // Track by asset name (if mentioned in subject/description)
      if (ticket.subject) {
        const assetName = ticket.subject.match(/Asset Issue: (.+)/)?.[1];
        if (assetName) {
          if (!assetTickets[assetName]) {
            assetTickets[assetName] = [];
          }
          assetTickets[assetName].push(ticket);
        }
      }
    });

    return { roomTickets, assetTickets };
  }, [tickets]);

  // Check if asset or its room has open tickets
  const hasOpenTickets = (asset) => {
    // Check direct asset match
    if (openTicketsByRoom.assetTickets[asset.name]?.length > 0) {
      return true;
    }

    // Check room match
    if (asset.room_id && openTicketsByRoom.roomTickets[asset.room_id]?.length > 0) {
      return true;
    }

    return false;
  };

  // Filtered rooms and groups for autocomplete
  const filteredRooms = useMemo(() => {
    if (!roomSearch) return floorRooms;
    const search = roomSearch.toLowerCase();
    return floorRooms.filter(room => {
      const roomNum = (room.room_number || '').toLowerCase();
      const roomName = (room.room_name || room.name || '').toLowerCase();
      return roomNum.includes(search) || roomName.includes(search);
    });
  }, [floorRooms, roomSearch]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch) return assetGroups;
    const search = groupSearch.toLowerCase();
    return assetGroups.filter(group => 
      group.name.toLowerCase().includes(search)
    );
  }, [assetGroups, groupSearch]);

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

      // Room filter
      if (roomFilter !== "all") {
        if (roomFilter === "unassigned") {
          if (asset.room_id) return false;
        } else {
          if (asset.room_id !== roomFilter) return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${asset.name} ${asset.model || ''} ${asset.serial_number || ''} ${asset.room_number || ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      return true;
    });
  }, [assets, selectedBuilding, selectedFloor, groupFilter, statusFilter, roomFilter, searchQuery, assetGroups]);

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
            {roomFilter !== "all" && selectedBuilding && selectedFloor && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <button
                  onClick={() => {
                    setSelectedBuilding(null);
                    setSelectedFloor(null);
                    setRoomFilter("all");
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  {selectedBuilding.name}
                </button>
                <span className="text-slate-400">→</span>
                <button
                  onClick={() => {
                    setRoomFilter("all");
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  {selectedFloor.name}
                </button>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-slate-900">
                  {roomFilter === "unassigned" 
                    ? "Unassigned Assets"
                    : floorRooms.find(r => r.id === roomFilter)?.room_name || 
                      floorRooms.find(r => r.id === roomFilter)?.room_number || 
                      "Room"}
                </span>
              </div>
            )}
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
                    <Button
                      variant={showOnlyWithTickets ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowOnlyWithTickets(!showOnlyWithTickets)}
                      className={showOnlyWithTickets ? "bg-orange-500 hover:bg-orange-600" : ""}
                    >
                      <Ticket className="w-4 h-4 mr-1" />
                      Tickets Only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRoomLabels(!showRoomLabels)}
                    >
                      {showRoomLabels ? 'Hide' : 'Show'} Room Labels
                    </Button>
                    <Badge variant="outline">
                      {filteredAssets.length} / {assetStats.byFloor} assets
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
                  assets={assets.filter(a => a.floor_id === selectedFloor.id)}
                  filteredAssets={filteredAssets}
                  selectedAsset={selectedAsset}
                  onAssetClick={handleAssetClick}
                  showPins={showPins}
                  showRoomLabels={showRoomLabels}
                  rooms={rooms.filter(r => r.floor_id === selectedFloor.id)}
                  roomFilter={roomFilter}
                  openTicketsByRoom={openTicketsByRoom}
                  showOnlyWithTickets={showOnlyWithTickets}
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

            <div className="space-y-2">
              {/* Room Filter - Autocomplete */}
              <div className="relative">
                <Input
                  placeholder={roomFilter === "all" ? `All Rooms (${roomAssetCounts.unassigned ? Object.values(roomAssetCounts).reduce((a, b) => a + b, 0) : assetStats.byFloor})` : roomFilter === "unassigned" ? "Unassigned" : floorRooms.find(r => r.id === roomFilter)?.room_number || floorRooms.find(r => r.id === roomFilter)?.room_name || "Room"}
                  value={roomSearch}
                  onChange={(e) => {
                    setRoomSearch(e.target.value);
                    setShowRoomDropdown(true);
                  }}
                  onFocus={() => setShowRoomDropdown(true)}
                  onBlur={() => setTimeout(() => setShowRoomDropdown(false), 200)}
                  className="pr-8"
                />
                {roomFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => {
                      setRoomFilter("all");
                      setRoomSearch("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                {showRoomDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    <div
                      className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm border-b"
                      onClick={() => {
                        setRoomFilter("all");
                        setRoomSearch("");
                        setShowRoomDropdown(false);
                      }}
                    >
                      All Rooms ({roomAssetCounts.unassigned ? Object.values(roomAssetCounts).reduce((a, b) => a + b, 0) : assetStats.byFloor})
                    </div>
                    <div
                      className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm border-b"
                      onClick={() => {
                        setRoomFilter("unassigned");
                        setRoomSearch("Unassigned");
                        setShowRoomDropdown(false);
                      }}
                    >
                      Unassigned ({roomAssetCounts.unassigned || 0})
                    </div>
                    {filteredRooms.slice(0, 50).map(room => {
                      const count = roomAssetCounts[room.id] || 0;
                      const label = room.room_name || room.name || room.room_number || 'Unnamed';
                      return (
                        <div
                          key={room.id}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                          onClick={() => {
                            setRoomFilter(room.id);
                            setRoomSearch(room.room_number ? `${room.room_number} – ${label}` : label);
                            setShowRoomDropdown(false);
                          }}
                        >
                          {room.room_number ? `${room.room_number} – ` : ''}{label} ({count})
                        </div>
                      );
                    })}
                    {filteredRooms.length > 50 && (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center border-t">
                        Showing 50 of {filteredRooms.length} rooms - keep typing to narrow results
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Group Filter - Autocomplete */}
                <div className="relative">
                  <Input
                    placeholder={groupFilter === "all" ? "All Groups" : groupFilter}
                    value={groupSearch}
                    onChange={(e) => {
                      setGroupSearch(e.target.value);
                      setShowGroupDropdown(true);
                    }}
                    onFocus={() => setShowGroupDropdown(true)}
                    onBlur={() => setTimeout(() => setShowGroupDropdown(false), 200)}
                    className={groupFilter !== "all" ? "pr-8" : ""}
                  />
                  {groupFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => {
                        setGroupFilter("all");
                        setGroupSearch("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {showGroupDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      <div
                        className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm border-b"
                        onClick={() => {
                          setGroupFilter("all");
                          setGroupSearch("");
                          setShowGroupDropdown(false);
                        }}
                      >
                        All Groups
                      </div>
                      {filteredGroups.map(group => (
                        <div
                          key={group.id}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                          onClick={() => {
                            setGroupFilter(group.name);
                            setGroupSearch(group.name);
                            setShowGroupDropdown(false);
                          }}
                        >
                          {group.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
                  <div>
                    <span className="font-medium text-slate-600">Room</span>
                    <Select
                      value={selectedAsset.room_id || "unassigned"}
                      onValueChange={async (value) => {
                        try {
                          const roomId = value === "unassigned" ? null : value;
                          const room = floorRooms.find(r => r.id === roomId);

                          await base44.entities.Asset.update(selectedAsset.id, {
                            room_id: roomId,
                            room_number: room?.room_number || null,
                            room_name: room?.name || null
                          });

                          // Refresh data
                          const updatedAssets = await base44.entities.Asset.list();
                          setAssets(updatedAssets);
                          setSelectedAsset(updatedAssets.find(a => a.id === selectedAsset.id));

                          toast.success('Room assignment updated');
                        } catch (error) {
                          console.error('Error updating room:', error);
                          toast.error('Failed to update room assignment');
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {floorRooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.room_number ? `${room.room_number} - ${room.name || 'Unnamed'}` : room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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

                <div className="space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (selectedAsset.building_id) params.set('building_id', selectedAsset.building_id);
                      if (selectedAsset.room_id) params.set('room_id', selectedAsset.room_id);
                      if (selectedAsset.asset_category) params.set('asset_category', selectedAsset.asset_category);
                      params.set('asset_name', selectedAsset.name);
                      navigate(createPageUrl('CreateTicket') + '?' + params.toString());
                    }}
                  >
                    <Ticket className="w-3 h-3 mr-2" />
                    Create Ticket for Asset
                  </Button>
                  
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
            </div>
          )}
          </div>
          </div>
          </div>
          );
          }

// Floorplan Canvas Component
function FloorplanCanvas({ imageUrl, assets, filteredAssets, selectedAsset, onAssetClick, showPins, showRoomLabels, rooms, roomFilter, openTicketsByRoom, showOnlyWithTickets }) {
  const isPdf = imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.includes('pdf');

  // Check if asset has open tickets (asset-scoped only)
  const hasOpenTickets = (asset) => {
    // Only check direct asset match - room tickets do NOT affect asset pins
    return openTicketsByRoom.assetTickets[asset.name]?.length > 0;
  };

  // Filter assets based on ticket filter
  const visibleAssets = showOnlyWithTickets 
    ? assets.filter(hasOpenTickets)
    : assets;

  // Calculate room label positions based on average asset coordinates
  const roomLabelPositions = React.useMemo(() => {
    const positions = {};
    
    rooms.forEach(room => {
      const roomAssets = assets.filter(a => a.room_id === room.id && a.x_coord !== null && a.y_coord !== null);
      
      if (roomAssets.length > 0) {
        const avgX = roomAssets.reduce((sum, a) => sum + a.x_coord, 0) / roomAssets.length;
        const avgY = roomAssets.reduce((sum, a) => sum + a.y_coord, 0) / roomAssets.length;
        
        positions[room.id] = {
          x: avgX * 100,
          y: avgY * 100,
          label: room.room_name || room.name || room.room_number || 'Unnamed'
        };
      }
    });
    
    return positions;
  }, [rooms, assets]);

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

      {/* Room Labels Overlay */}
      {showRoomLabels && (
        <div className="absolute inset-0 pointer-events-none">
          {Object.entries(roomLabelPositions).map(([roomId, pos]) => (
            <div
              key={roomId}
              className="absolute"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-lg border border-slate-300 text-xs font-medium text-slate-900 whitespace-nowrap">
                {pos.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Pins Overlay */}
      {showPins && (
        <div className="absolute inset-0 pointer-events-none">
          {visibleAssets.map(asset => {
            if (asset.x_coord === null || asset.y_coord === null) return null;

            const isSelected = selectedAsset?.id === asset.id;
            const isFiltered = filteredAssets.some(a => a.id === asset.id);
            const isRoomFiltered = roomFilter !== "all";
            const hasTickets = hasOpenTickets(asset);

            // Convert 0-1 normalized coords to percentage
            const xPercent = asset.x_coord * 100;
            const yPercent = asset.y_coord * 100;

            // Build tooltip text
            let tooltipText = asset.name;
            if (hasTickets) {
              const assetTickets = openTicketsByRoom.assetTickets[asset.name] || [];

              // Show asset-level tickets only
              assetTickets.forEach(ticket => {
                const statusLabel = ticket.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                tooltipText += `\n🔧 ASSET: ${ticket.subject || 'Untitled'} (${statusLabel})`;
              });
            }

            return (
              <motion.div
                key={asset.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: isRoomFiltered && !isFiltered ? 0.5 : 1
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
                      : hasTickets
                      ? 'bg-orange-500 hover:bg-orange-600 ring-2 ring-orange-300'
                      : isFiltered && isRoomFiltered
                      ? 'bg-yellow-500 hover:bg-yellow-600 ring-2 ring-yellow-300'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                  title={tooltipText}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}