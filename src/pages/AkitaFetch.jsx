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
  X,
  AlertCircle
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
  const [selectedRoom, setSelectedRoom] = useState(null);
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
    setSelectedRoom(null);
  };

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
    setSelectedAsset(null);
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
  // CRITICAL: Ticket scope rules for visuals
  // - Asset pins ONLY change based on asset-scoped tickets for THAT asset_id
  // - Room indicators ONLY change based on room-scoped tickets for THAT room_id
  // - NO cascading: asset tickets do NOT affect sibling assets or room visuals
  // - NO cascading: room tickets do NOT affect asset visuals
  // - Building-level or unscoped tickets do NOT affect visuals
  const openTicketsByRoom = useMemo(() => {
    const roomTickets = {};
    const assetTickets = {};

    // Filter for open tickets only - specific statuses
    const openStatuses = ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'];
    const openTickets = tickets.filter(t => 
      openStatuses.includes(t.status)
    );

    openTickets.forEach(ticket => {
      // Track by scope using IDs - NEVER mix scopes for visual indicators
      if (ticket.scope === "ROOM" && ticket.room_id) {
        if (!roomTickets[ticket.room_id]) {
          roomTickets[ticket.room_id] = [];
        }
        roomTickets[ticket.room_id].push(ticket);
      } else if (ticket.scope === "ASSET" && ticket.asset_id) {
        if (!assetTickets[ticket.asset_id]) {
          assetTickets[ticket.asset_id] = [];
        }
        assetTickets[ticket.asset_id].push(ticket);
      }
    });

    return { roomTickets, assetTickets };
  }, [tickets]);

  // Room-level heat aggregation (for analytics/data - NOT for visuals)
  // NOTE: This aggregates ALL tickets affecting a room (both room-scoped and asset-scoped)
  // for comprehensive heat metrics, but visual indicators must ONLY use scope-specific data
  const roomHeatData = useMemo(() => {
    const heatMap = {};
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    rooms.forEach(room => {
      // Count assets in this room
      const roomAssets = assets.filter(a => a.room_id === room.id);
      const assetCount = roomAssets.length;

      // Get all tickets affecting this room:
      // 1. Room-scoped tickets directly on this room
      const directRoomTickets = tickets.filter(t => 
        t.scope === "ROOM" && t.room_id === room.id
      );

      // 2. Asset-scoped tickets for assets in this room
      const assetTicketsInRoom = tickets.filter(t => {
        if (t.scope !== "ASSET" || !t.asset_name) return false;
        // Check if any asset in this room matches the ticket's asset_name
        return roomAssets.some(asset => asset.name === t.asset_name);
      });

      // Combine all tickets affecting this room
      const allRoomTickets = [...directRoomTickets, ...assetTicketsInRoom];

      // Calculate metrics
      const openStatuses = ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'];
      const openTickets = allRoomTickets.filter(t => openStatuses.includes(t.status));
      
      const tickets30d = allRoomTickets.filter(t => {
        const createdDate = new Date(t.created_date).getTime();
        return createdDate >= thirtyDaysAgo;
      });

      const tickets90d = allRoomTickets.filter(t => {
        const createdDate = new Date(t.created_date).getTime();
        return createdDate >= ninetyDaysAgo;
      });

      // Find most recent ticket date
      let lastTicketDate = null;
      if (allRoomTickets.length > 0) {
        const sortedByDate = [...allRoomTickets].sort((a, b) => 
          new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
        );
        lastTicketDate = sortedByDate[0].created_date;
      }

      // Determine heat state
      const hasCriticalTicket = openTickets.some(t => 
        ['safety', 'fire', 'life_safety'].includes(t.category?.toLowerCase())
      );
      
      let heatState = 'none';
      if (hasCriticalTicket) {
        heatState = 'critical';
      } else if (openTickets.length >= 6) {
        heatState = 'high';
      } else if (openTickets.length >= 3) {
        heatState = 'medium';
      } else if (openTickets.length >= 1) {
        heatState = 'low';
      }

      heatMap[room.id] = {
        open_ticket_count: openTickets.length,
        tickets_30d: tickets30d.length,
        tickets_90d: tickets90d.length,
        asset_count: assetCount,
        last_ticket_date: lastTicketDate,
        heat_state: heatState
      };
    });

    return heatMap;
  }, [rooms, assets, tickets]);

  // Check if asset has open tickets (asset-scoped only)
  const hasOpenTickets = (asset) => {
    // Only check direct asset_id match - room tickets do NOT affect asset pins
    return openTicketsByRoom.assetTickets[asset.id]?.length > 0;
  };

  // Room-level ticket aggregation for selected room
  const roomTicketMetrics = useMemo(() => {
    if (!selectedRoom) return null;

    const openStatuses = ['open', 'awaiting_information', 'awaiting_parts'];
    const allRoomTickets = tickets.filter(t => t.room_id === selectedRoom.id);
    const openRoomTickets = allRoomTickets.filter(t => openStatuses.includes(t.status));

    // Priority order for sorting
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Sort by priority (critical first) then by newest created_date
    const sortedOpenTickets = [...openRoomTickets].sort((a, b) => {
      const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_date) - new Date(a.created_date);
    });

    // Compute last activity
    let roomLastActivityAt = null;
    if (allRoomTickets.length > 0) {
      const dates = allRoomTickets.map(t => new Date(t.last_activity_at || t.created_date));
      roomLastActivityAt = new Date(Math.max(...dates));
    }

    return {
      openRoomTickets: sortedOpenTickets,
      roomOpenTicketCount: sortedOpenTickets.length,
      roomLastActivityAt
    };
  }, [selectedRoom, tickets]);

  // Filtered rooms and groups for autocomplete
  // Include Exterior rooms from same building in addition to floor rooms
  const filteredRooms = useMemo(() => {
    const buildingExteriorRooms = selectedBuilding 
      ? rooms.filter(r => r.building_id === selectedBuilding.id && r.category === "Exterior")
      : [];
    const allSelectableRooms = [...floorRooms, ...buildingExteriorRooms];
    
    if (!roomSearch) return allSelectableRooms;
    const search = roomSearch.toLowerCase();
    return allSelectableRooms.filter(room => {
      const roomNum = (room.room_number || '').toLowerCase();
      const roomName = (room.room_name || room.name || '').toLowerCase();
      return roomNum.includes(search) || roomName.includes(search);
    });
  }, [floorRooms, roomSearch, selectedBuilding, rooms]);

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
                  onRoomClick={handleRoomClick}
                  selectedBuilding={selectedBuilding}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-sm">Assets</h3>
                <Badge variant="secondary">
                  {filteredAssets.length}
                </Badge>
              </div>
              {selectedBuilding && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (selectedBuilding.id) params.set('building_id', selectedBuilding.id);
                    if (selectedFloor?.id) params.set('floor_id', selectedFloor.id);
                    navigate(createPageUrl('CreateTicket') + '?' + params.toString());
                  }}
                  className="text-xs"
                >
                  <Ticket className="w-3 h-3 mr-1" />
                  Report Issue
                </Button>
              )}
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{asset.name}</div>
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
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams();
                                if (asset.building_id) params.set('building_id', asset.building_id);
                                if (asset.room_id) params.set('room_id', asset.room_id);
                                if (asset.id) params.set('asset_id', asset.id);
                                if (asset.asset_category) params.set('asset_category', asset.asset_category);
                                params.set('asset_name', asset.name);
                                navigate(createPageUrl('CreateTicket') + '?' + params.toString());
                              }}
                            >
                              <Ticket className="w-3.5 h-3.5 text-slate-500 hover:text-blue-600" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Room Details Panel */}
          {selectedRoom && (
            <div className="border-t bg-slate-50 max-h-96 overflow-y-auto">
              {/* Room Header */}
              <div className="p-4 bg-white border-b">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 text-base">
                      {selectedRoom.room_name || selectedRoom.description || 'Unnamed Room'}
                    </h4>
                    {selectedRoom.room_number && (
                      <p className="text-sm text-slate-600">Room {selectedRoom.room_number}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selectedRoom.category || 'Interior'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div>{selectedRoom.building_name || 'N/A'}</div>
                  <div>{selectedRoom.floor_name || 'N/A'}</div>
                </div>
              </div>

              {/* Room Status */}
              <div className="p-4 border-b bg-white">
                {(() => {
                  const roomTickets = openTicketsByRoom.roomTickets[selectedRoom.id] || [];
                  const roomAssets = assets.filter(a => a.room_id === selectedRoom.id);

                  // Check for safety/life-safety tickets
                  const hasSafetyTicket = roomTickets.some(t => 
                    t.priority === 'critical' || 
                    ['fire', 'safety', 'emergency', 'life safety', 'water leak', 'flood'].some(kw => 
                      t.subject?.toLowerCase().includes(kw) || t.description?.toLowerCase().includes(kw)
                    )
                  );

                  // Count assets with open tickets
                  const assetsWithTickets = roomAssets.filter(asset => 
                    openTicketsByRoom.assetTickets[asset.id]?.length > 0
                  ).length;

                  // Determine status
                  let status = 'normal';
                  let explanation = 'No open issues';

                  if (hasSafetyTicket) {
                    status = 'critical';
                    explanation = 'Safety or life-safety ticket';
                  } else if (roomTickets.length > 0) {
                    status = 'warning';
                    explanation = `${roomTickets.length} room-level ticket${roomTickets.length > 1 ? 's' : ''}`;
                  } else if (assetsWithTickets >= 2) {
                    status = 'warning';
                    explanation = `${assetsWithTickets} assets with open tickets`;
                  } else if (assetsWithTickets === 1) {
                    explanation = '1 asset with open ticket';
                  }

                  const statusConfig = {
                    normal: { color: 'bg-green-50 border-green-200 text-green-800', icon: '✓', label: 'Normal' },
                    warning: { color: 'bg-orange-50 border-orange-200 text-orange-800', icon: '⚠', label: 'Needs Attention' },
                    critical: { color: 'bg-red-50 border-red-200 text-red-800', icon: '🚨', label: 'Critical' }
                  };

                  const config = statusConfig[status];

                  return (
                    <div className={`rounded-lg border p-3 ${config.color}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{config.icon}</span>
                        <span className="font-semibold text-sm">{config.label}</span>
                      </div>
                      <p className="text-xs">{explanation}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-slate-900">
                      {assets.filter(a => a.room_id === selectedRoom.id).length}
                    </div>
                    <div className="text-xs text-slate-600">Assets</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-orange-600">
                      {openTicketsByRoom.roomTickets[selectedRoom.id]?.length || 0}
                    </div>
                    <div className="text-xs text-slate-600">Open Tickets</div>
                  </div>
                </div>

                {/* Open Tickets */}
                {openTicketsByRoom.roomTickets[selectedRoom.id]?.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-xs text-slate-700 mb-2">Open Tickets (Room)</h5>
                    <div className="space-y-2">
                      {openTicketsByRoom.roomTickets[selectedRoom.id].map(ticket => {
                        const createdDate = new Date(ticket.created_date);
                        const daysOld = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={ticket.id} className="bg-white rounded-lg border p-2">
                            <div className="font-medium text-xs text-slate-900 mb-1">{ticket.subject}</div>
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <Badge variant="outline" className="text-xs capitalize">
                                {ticket.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {ticket.status.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-slate-500">{daysOld}d old</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Assets Grouped by Category */}
                <div>
                  <h5 className="font-semibold text-xs text-slate-700 mb-2">Assets by Category</h5>
                  {(() => {
                    const roomAssets = assets.filter(a => a.room_id === selectedRoom.id);
                    if (roomAssets.length === 0) {
                      return <p className="text-xs text-slate-500 text-center py-4">No assets in this room</p>;
                    }

                    const groupedAssets = roomAssets.reduce((acc, asset) => {
                      const category = asset.asset_category || 'Uncategorized';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(asset);
                      return acc;
                    }, {});

                    return (
                      <div className="space-y-3">
                        {Object.entries(groupedAssets).map(([category, categoryAssets]) => (
                          <div key={category}>
                            <div className="text-xs font-medium text-slate-600 mb-1.5">{category}</div>
                            <div className="space-y-1">
                             {categoryAssets.map(asset => {
                               return (
                                  <div
                                    key={asset.id}
                                    className="bg-white rounded border p-2 cursor-pointer hover:border-blue-300 transition-colors"
                                    onClick={() => handleAssetClick(asset)}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-xs text-slate-900 truncate">{asset.name}</div>
                                        {asset.model && (
                                          <div className="text-xs text-slate-500 truncate">{asset.model}</div>
                                        )}
                                      </div>
                                      {openTicketsByRoom.assetTickets[asset.id]?.length > 0 && (
                                        <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 ml-2" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (selectedRoom.building_id) params.set('building_id', selectedRoom.building_id);
                      if (selectedRoom.id) params.set('room_id', selectedRoom.id);
                      navigate(createPageUrl('CreateTicket') + '?' + params.toString());
                    }}
                  >
                    <Ticket className="w-3 h-3 mr-2" />
                    Create Ticket for Room
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      navigate(createPageUrl('SupportTickets') + `?room_id=${selectedRoom.id}`);
                    }}
                  >
                    View Ticket History
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Asset Details */}
          {selectedAsset && !selectedRoom && (
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
                      if (selectedAsset.id) params.set('asset_id', selectedAsset.id);
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
function FloorplanCanvas({ imageUrl, assets, filteredAssets, selectedAsset, onAssetClick, showPins, showRoomLabels, rooms, roomFilter, openTicketsByRoom, showOnlyWithTickets, onRoomClick, selectedBuilding }) {
  const [scale, setScale] = React.useState(selectedBuilding?.floorplan_scale || 1);
  const [offsetX, setOffsetX] = React.useState(selectedBuilding?.floorplan_offset_x || 0);
  const [offsetY, setOffsetY] = React.useState(selectedBuilding?.floorplan_offset_y || 0);
  const [showAdjustControls, setShowAdjustControls] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const isPdf = imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.includes('pdf');

  // Load building settings when building changes
  React.useEffect(() => {
    if (selectedBuilding) {
      setScale(selectedBuilding.floorplan_scale || 1);
      setOffsetX(selectedBuilding.floorplan_offset_x || 0);
      setOffsetY(selectedBuilding.floorplan_offset_y || 0);
    }
  }, [selectedBuilding?.id]);

  const saveAlignment = async () => {
    if (!selectedBuilding) return;
    setSaving(true);
    try {
      await base44.entities.Building.update(selectedBuilding.id, {
        floorplan_scale: scale,
        floorplan_offset_x: offsetX,
        floorplan_offset_y: offsetY
      });
      toast.success('Floor plan alignment saved');
    } catch (error) {
      console.error('Error saving alignment:', error);
      toast.error('Failed to save alignment');
    } finally {
      setSaving(false);
    }
  };

  // Check if asset has open tickets (asset-scoped only)
  const hasOpenTickets = (asset) => {
    // Only check direct asset_id match - room tickets do NOT affect asset pins
    return openTicketsByRoom.assetTickets[asset.id]?.length > 0;
  };

  // Filter assets based on ticket filter
  const visibleAssets = showOnlyWithTickets 
    ? assets.filter(hasOpenTickets)
    : assets;

  // Calculate room label positions based on average asset coordinates
  // Exclude Exterior rooms from floor plan rendering
  const roomLabelPositions = React.useMemo(() => {
    const positions = {};

    rooms.forEach(room => {
      // Skip Exterior rooms - they are not rendered on floor plans
      if (room.category === "Exterior") return;

      const roomAssets = assets.filter(a => a.room_id === room.id && a.x_coord !== null && a.y_coord !== null);

      if (roomAssets.length > 0) {
        const avgX = roomAssets.reduce((sum, a) => sum + a.x_coord, 0) / roomAssets.length;
        const avgY = roomAssets.reduce((sum, a) => sum + a.y_coord, 0) / roomAssets.length;

        // Room label color logic
        const roomTickets = openTicketsByRoom.roomTickets[room.id] || [];
        const hasRoomTicket = roomTickets.length > 0;

        // Check for safety/life-safety tickets
        const hasSafetyTicket = roomTickets.some(t => 
          t.priority === 'critical' || 
          ['fire', 'safety', 'emergency', 'life safety', 'water leak', 'flood'].some(kw => 
            t.subject?.toLowerCase().includes(kw) || t.description?.toLowerCase().includes(kw)
          )
        );

        // Count assets with open tickets in this room
        const assetsWithTickets = roomAssets.filter(asset => 
          openTicketsByRoom.assetTickets[asset.id]?.length > 0
        ).length;

        // Determine status
        let status = 'normal'; // green
        if (hasSafetyTicket) {
          status = 'critical'; // red
        } else if (hasRoomTicket || assetsWithTickets >= 2) {
          status = 'warning'; // orange
        }

        positions[room.id] = {
          x: avgX * 100,
          y: avgY * 100,
          label: room.room_name || room.name || room.room_number || 'Unnamed',
          status: status,
          room: room
        };
      }
    });

    return positions;
  }, [rooms, assets, openTicketsByRoom]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white rounded-lg shadow-inner">
      {/* Alignment Controls */}
      {!isPdf && (
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdjustControls(!showAdjustControls)}
            className="bg-white shadow-lg"
          >
            {showAdjustControls ? 'Hide' : 'Align Floor Plan'}
          </Button>
          
          {showAdjustControls && (
            <div className="mt-2 bg-white rounded-lg shadow-xl border p-4 space-y-3 w-64">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Scale: {scale.toFixed(2)}x
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScale(Math.max(0.1, scale - 0.1))}
                  >
                    -
                  </Button>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScale(Math.min(3, scale + 0.1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Horizontal Offset: {offsetX}px
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetX(offsetX - 10)}
                  >
                    ←
                  </Button>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    step="10"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetX(offsetX + 10)}
                  >
                    →
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Vertical Offset: {offsetY}px
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetY(offsetY - 10)}
                  >
                    ↑
                  </Button>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    step="10"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetY(offsetY + 10)}
                  >
                    ↓
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScale(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className="flex-1"
                >
                  Reset
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveAlignment}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
          style={{
            transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`,
            transition: 'transform 0.1s ease-out'
          }}
          onError={(e) => {
            console.error('Image failed to load:', imageUrl);
            e.target.alt = 'Failed to load floor plan';
          }}
        />
      )}

      {/* Room Labels Overlay */}
      {showRoomLabels && (
        <div className="absolute inset-0">
          {Object.entries(roomLabelPositions).map(([roomId, pos]) => (
            <div
              key={roomId}
              className="absolute pointer-events-auto group"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="flex items-center gap-1">
                <div 
                  className={`bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-lg text-xs font-medium whitespace-nowrap hover:shadow-xl transition-shadow cursor-pointer ${
                    pos.status === 'critical' 
                      ? 'border-2 border-red-500 text-red-900' 
                      : pos.status === 'warning'
                      ? 'border-2 border-orange-500 text-orange-900' 
                      : 'border border-slate-300 text-slate-900'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pos.room && onRoomClick) onRoomClick(pos.room);
                  }}
                >
                  {pos.label}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-700 text-white rounded-md p-1 shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    const params = new URLSearchParams();
                    if (pos.room.building_id) params.set('building_id', pos.room.building_id);
                    if (pos.room.id) params.set('room_id', pos.room.id);
                    onAssetClick(null); // Clear selection
                    window.location.href = createPageUrl('CreateTicket') + '?' + params.toString();
                  }}
                  title="Create ticket for this room"
                >
                  <Ticket className="w-3 h-3" />
                </button>
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
              const assetTickets = openTicketsByRoom.assetTickets[asset.id] || [];

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