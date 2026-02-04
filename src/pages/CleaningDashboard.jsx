import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Flame, ThermometerSun, CheckCircle2, Calendar, Building2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import CleaningAcknowledgeModal from "@/components/eventops/CleaningAcknowledgeModal";

export default function CleaningDashboard() {
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildingFilter, setBuildingFilter] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState("all");
  const [buildings, setBuildings] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [showAckModal, setShowAckModal] = useState(false);
  const [markingClean, setMarkingClean] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadWarnings();
  }, [buildingFilter, temperatureFilter]);

  const loadInitialData = async () => {
    try {
      const [roomsData, buildingsData] = await Promise.all([
        base44.entities.Room.list(),
        base44.entities.Building.list()
      ]);
      setAllRooms(roomsData);
      setBuildings(buildingsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data');
    }
  };

  const loadWarnings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (buildingFilter) params.set('building', buildingFilter);
      if (temperatureFilter !== 'all') params.set('temperature', temperatureFilter.toUpperCase());

      const result = await base44.functions.invoke('getRoomWarnings', {});
      
      let warningsData = result.data.warnings || [];
      
      // Apply filters
      if (buildingFilter) {
        warningsData = warningsData.filter(w => w.building === buildingFilter);
      }
      if (temperatureFilter !== 'all') {
        warningsData = warningsData.filter(w => w.temperature === temperatureFilter.toUpperCase());
      }

      setWarnings(warningsData);
    } catch (error) {
      console.error('Error loading warnings:', error);
      toast.error('Failed to load cleaning warnings');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkClean = async (roomId, roomName) => {
    if (!confirm(`Mark ${roomName} as clean?\n\nThis will update last_cleaned_at and clear the warning.`)) {
      return;
    }

    setMarkingClean(roomId);
    try {
      const user = await base44.auth.me();
      
      await base44.functions.invoke('markRoomAsClean', {
        room_id: roomId,
        marked_by_user_id: user.email,
        marked_by_user_name: user.full_name
      });

      toast.success('✓ Room marked as clean!');
      await loadWarnings();
    } catch (error) {
      console.error('Mark clean error:', error);
      toast.error('Failed to mark room as clean');
    } finally {
      setMarkingClean(null);
    }
  };

  const handleAcknowledge = (warning) => {
    const room = allRooms.find(r => r.id === warning.room_id);
    if (room) {
      setSelectedRoom(room);
      setSelectedWarning(warning);
      setShowAckModal(true);
    }
  };

  const handleAcknowledged = async () => {
    setShowAckModal(false);
    await loadWarnings();
  };

  const hotRooms = warnings.filter(w => w.temperature === 'HOT');
  const warmRooms = warnings.filter(w => w.temperature === 'WARM');
  const coolRooms = allRooms.filter(r => !warnings.find(w => w.room_id === r.id));

  const getTemperatureIcon = (temp) => {
    switch(temp) {
      case 'HOT': return <Flame className="w-5 h-5 text-red-500" />;
      case 'WARM': return <ThermometerSun className="w-5 h-5 text-orange-500" />;
      default: return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
  };

  const getTemperatureColor = (temp) => {
    switch(temp) {
      case 'HOT': return 'bg-red-50 border-red-200';
      case 'WARM': return 'bg-orange-50 border-orange-200';
      default: return 'bg-green-50 border-green-200';
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Cleaning Dashboard</h1>
              <p className="text-sm text-slate-600">Monitor and manage room cleaning status</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">🔥 URGENT</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{hotRooms.length}</p>
                  <p className="text-xs text-red-600 mt-1">Event &lt; 24 hrs or behind schedule</p>
                </div>
                <Flame className="w-12 h-12 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">🟡 ATTENTION</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{warmRooms.length}</p>
                  <p className="text-xs text-orange-600 mt-1">Needs attention soon</p>
                </div>
                <ThermometerSun className="w-12 h-12 text-orange-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">✅ ON SCHEDULE</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{coolRooms.length}</p>
                  <p className="text-xs text-green-600 mt-1">No warnings</p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Buildings</SelectItem>
                    {buildings.map(building => (
                      <SelectItem key={building.id} value={building.name}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="hot">🔥 Hot Only</SelectItem>
                    <SelectItem value="warm">🟡 Warm Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={loadWarnings}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warnings List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : warnings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear!</h3>
              <p className="text-sm text-slate-600">No rooms need cleaning attention right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {warnings.map((warning) => (
              <Card key={warning.room_id} className={`border-2 ${getTemperatureColor(warning.temperature)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getTemperatureIcon(warning.temperature)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {warning.room_name || warning.room_number}
                        </h3>
                        <Badge variant="outline" className={`text-xs ${
                          warning.temperature === 'HOT' ? 'bg-red-100 text-red-800 border-red-300' :
                          warning.temperature === 'WARM' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                          'bg-green-100 text-green-800 border-green-300'
                        }`}>
                          {warning.temperature}
                        </Badge>
                      </div>

                      <p className="text-sm text-slate-700 mb-2">{warning.warning_text}</p>

                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {warning.building && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {warning.building}
                          </span>
                        )}
                        {warning.floor && (
                          <span>• {warning.floor}</span>
                        )}
                        {warning.room_number && (
                          <span>• Room {warning.room_number}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(warning)}
                        className="whitespace-nowrap"
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        Set Plan
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkClean(warning.room_id, warning.room_name || warning.room_number)}
                        disabled={markingClean === warning.room_id}
                        className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                      >
                        {markingClean === warning.room_id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        )}
                        Mark Clean
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CleaningAcknowledgeModal
        open={showAckModal}
        onOpenChange={setShowAckModal}
        room={selectedRoom}
        warning={selectedWarning}
        onAcknowledged={handleAcknowledged}
      />
    </div>
  );
}