
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  Loader2,
  ArrowLeft,
  Layers,
  MapPin,
  Package,
  Plus,
  Search,
  Grid3x3,
  Ticket,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function AkitaFetch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rooms");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    if (selectedBuilding && selectedLevel) {
      loadRooms();
      loadAssets();
    }
  }, [selectedBuilding, selectedLevel]);

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching buildings from AkitaBox...');
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'buildings'
      });
      
      console.log('AkitaBox response:', response);
      
      if (response.data.success) {
        const buildingsData = response.data.data.buildings || [];
        console.log('Buildings loaded:', buildingsData.length);
        setBuildings(buildingsData);
        
        if (buildingsData.length === 0) {
          setError('No buildings found in AkitaBox');
        }
      } else {
        const errorMsg = response.data.error || 'Failed to load buildings';
        const errorDetails = response.data.details || '';
        console.error('Error from backend:', errorMsg, errorDetails);
        setError(`${errorMsg}${errorDetails ? ': ' + errorDetails : ''}`);
      }
    } catch (error) {
      console.error('Error loading buildings:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMsg = error.response?.data?.error || error.message || 'Failed to connect to AkitaBox';
      const errorDetails = error.response?.data?.details || '';
      
      setError(`${errorMsg}${errorDetails ? '\n\nDetails: ' + errorDetails : ''}`);
      toast.error('Failed to load buildings');
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    if (!selectedBuilding || !selectedLevel) return;
    
    setLoadingRooms(true);
    try {
      console.log('Loading rooms for:', { buildingId: selectedBuilding.id, levelId: selectedLevel._id });
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'rooms',
        buildingId: selectedBuilding.id,
        levelId: selectedLevel._id
      });
      
      console.log('Rooms response:', response);
      
      if (response.data.success) {
        const roomsData = response.data.data.rooms || [];
        console.log('Rooms data:', roomsData.length, roomsData);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      console.error('Error response:', error.response?.data);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadAssets = async () => {
    if (!selectedBuilding || !selectedLevel) return;
    
    setLoadingAssets(true);
    try {
      console.log('Loading assets for:', { buildingId: selectedBuilding.id, levelId: selectedLevel._id });
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'assets',
        buildingId: selectedBuilding.id,
        levelId: selectedLevel._id
      });
      
      console.log('Assets response:', response);
      
      if (response.data.success) {
        const assetsData = response.data.data.assets || [];
        console.log('Assets data:', assetsData.length, assetsData);
        setAssets(Array.isArray(assetsData) ? assetsData : []);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
      console.error('Error response:', error.response?.data);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleCreateTicket = (room = null, asset = null) => {
    const params = new URLSearchParams();
    if (selectedBuilding) {
      params.set('building_id', selectedBuilding.id);
      params.set('building_name', selectedBuilding.name);
    }
    if (selectedLevel) {
      params.set('level', selectedLevel.name);
    }
    if (room) {
      params.set('room', room.name || room.number);
    }
    if (asset) {
      params.set('asset', asset.name);
    }
    
    navigate(createPageUrl('CreateTicket') + '?' + params.toString());
  };

  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (room.name?.toLowerCase().includes(query) || 
            room.number?.toLowerCase().includes(query));
  });

  const filteredAssets = assets.filter(asset => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (asset.name?.toLowerCase().includes(query) || 
            asset.type?.toLowerCase().includes(query));
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">Loading buildings from AkitaBox...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto pt-12">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-900">
              <p className="font-semibold mb-2">Failed to load AkitaBox data</p>
              <pre className="text-sm whitespace-pre-wrap bg-red-100 p-3 rounded mt-2 text-red-800">{error}</pre>
              <Button 
                onClick={loadBuildings}
                className="mt-4"
                size="sm"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/af69470b7_akitafetch_hybrid_64x64.png"
              alt="AkitaFetch"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                AkitaFetch
              </h1>
              <p className="text-sm text-slate-600">Browse buildings, floor plans, rooms, and assets</p>
            </div>
          </div>
        </div>

        {buildings.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Buildings Found
              </h3>
              <p className="text-slate-600 mb-6">
                No buildings were found in your AkitaBox organization.
              </p>
              <Button onClick={loadBuildings}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : !selectedBuilding ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buildings.map((building) => (
              <motion.div
                key={building.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setSelectedBuilding(building)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{building.name}</CardTitle>
                          {building.address && (
                            <p className="text-xs text-slate-600 mt-1">{building.address}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        <span>{building.levels?.length || 0} floors</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : !selectedLevel ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedBuilding(null)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Buildings
            </Button>

            <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedBuilding.name}</h2>
                    {selectedBuilding.address && (
                      <p className="text-sm text-slate-600">{selectedBuilding.address}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <h3 className="text-xl font-bold text-slate-900 mb-4">Select a Floor</h3>
            
            {selectedBuilding.levels && selectedBuilding.levels.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedBuilding.levels.map((level) => (
                  <motion.div
                    key={level._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => {
                        console.log('Selected level:', level);
                        setSelectedLevel(level);
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                            <Layers className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-lg text-slate-900">{level.name}</p>
                            <p className="text-xs text-slate-600">Click to view</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Floors Available
                  </h3>
                  <p className="text-slate-600">
                    This building has no floor data in AkitaBox.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLevel(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Floors
              </Button>
              <Badge variant="outline" className="ml-auto">
                {selectedBuilding.name} - {selectedLevel.name}
              </Badge>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Grid3x3 className="w-5 h-5" />
                    {selectedBuilding.name} - {selectedLevel.name}
                  </CardTitle>
                  <Button
                    onClick={() => handleCreateTicket()}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search rooms or assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rooms">
                  <MapPin className="w-4 h-4 mr-2" />
                  Rooms ({filteredRooms.length})
                </TabsTrigger>
                <TabsTrigger value="assets">
                  <Package className="w-4 h-4 mr-2" />
                  Assets ({filteredAssets.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rooms" className="space-y-3 mt-4">
                {loadingRooms ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">No rooms found on this floor</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRooms.map((room) => (
                      <Card key={room._id} className="hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">
                                {room.name || room.number || 'Unnamed Room'}
                              </p>
                              {room.type && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {room.type}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleCreateTicket(room)}
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            <Ticket className="w-3 h-3 mr-2" />
                            Create Ticket
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assets" className="space-y-3 mt-4">
                {loadingAssets ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">No assets found on this floor</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAssets.map((asset) => (
                      <Card key={asset._id} className="hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">
                                {asset.name || 'Unnamed Asset'}
                              </p>
                              {asset.type && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {asset.type}
                                </Badge>
                              )}
                              {asset.tag && (
                                <p className="text-xs text-slate-500 mt-1">ID: {asset.tag}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleCreateTicket(null, asset)}
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            <Ticket className="w-3 h-3 mr-2" />
                            Create Ticket
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
