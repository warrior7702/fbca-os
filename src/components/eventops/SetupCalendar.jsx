import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, AlertTriangle, Building2, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

function generateDays() {
  const today = new Date();
  const days = [];
  
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    days.push({
      dateNum: date.getDate(),
      dayName: format(date, 'EEE'), // Mon, Tue, etc.
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      fullDate: format(date, 'yyyy-MM-dd')
    });
  }
  
  return days;
}

export default function SetupCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBuildings, setExpandedBuildings] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [searchRoom, setSearchRoom] = useState("");

  useEffect(() => {
    loadCalendarData();
    
    // Log the 14-day array for verification
    const days = generateDays();
    console.log('14-Day Array:', days);
  }, []);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke("getSetupCalendarEvents", {});
      const result = response.data;
      setData(result);
      
      // Expand all buildings by default
      const buildingMap = {};
      result.buildings.forEach((building) => {
        buildingMap[building.building_id] = true;
      });
      setExpandedBuildings(buildingMap);
    } catch (error) {
      console.error("Error loading calendar data:", error);
      toast.error("Failed to load setup calendar data");
    } finally {
      setLoading(false);
    }
  };

  const toggleBuilding = (buildingId) => {
    setExpandedBuildings((prev) => ({
      ...prev,
      [buildingId]: !prev[buildingId],
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading setup calendar...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-slate-600">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, buildings } = data;
  const setupTasks = summary.total_events * 2;

  // Filter buildings
  const filteredBuildings =
    selectedBuilding === "all"
      ? buildings
      : buildings.filter((b) => b.building_id === selectedBuilding);

  // Summary cards
  const summaryCards = [
    {
      label: "Total Events",
      value: summary.total_events,
      icon: Calendar,
      bgClass: "bg-emerald-50",
      accentClass: "text-emerald-600",
    },
    {
      label: "Setup Conflicts",
      value: summary.total_conflicts,
      icon: AlertTriangle,
      bgClass: "bg-red-50",
      accentClass: "text-red-600",
    },
    {
      label: "Active Rooms",
      value: summary.active_rooms,
      icon: Building2,
      bgClass: "bg-blue-50",
      accentClass: "text-blue-600",
    },
    {
      label: "Setup Tasks",
      value: setupTasks,
      icon: CheckCircle2,
      bgClass: "bg-slate-50",
      accentClass: "text-slate-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className={card.bgClass}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">
                      {card.label}
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${card.accentClass}`}>
                      {card.value}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${card.accentClass} opacity-20`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                2-Week Grid
              </Button>
              <Button variant="outline" size="sm" disabled>
                Week Strips
              </Button>
            </div>

            <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings.map((building) => (
                  <SelectItem key={building.building_id} value={building.building_id}>
                    {building.building_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search rooms..."
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="w-48"
            />

            <Button variant="outline" size="sm" onClick={loadCalendarData}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Building Sections */}
      <div className="space-y-4">
        {filteredBuildings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              No events found
            </CardContent>
          </Card>
        ) : (
          filteredBuildings.map((building) => {
            const isExpanded = expandedBuildings[building.building_id] ?? true;
            const roomCount = building.rooms?.length || 0;
            const eventCount = building.rooms?.reduce(
              (sum, room) => sum + (room.events?.length || 0),
              0
            ) || 0;
            const conflictCount = building.rooms?.reduce(
              (sum, room) => sum + (room.conflicts?.length || 0),
              0
            ) || 0;

            return (
              <div key={building.building_id} className="border rounded-lg overflow-hidden">
                {/* Building Header */}
                <div
                  className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 cursor-pointer flex items-center justify-between transition-colors"
                  onClick={() => toggleBuilding(building.building_id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {building.building_name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="bg-slate-700 px-3 py-1 rounded-full">
                      {roomCount} rooms
                    </span>
                    <span className="bg-slate-700 px-3 py-1 rounded-full">
                      {eventCount} events
                    </span>
                    {conflictCount > 0 && (
                      <span className="bg-red-600 px-3 py-1 rounded-full">
                        {conflictCount} conflicts
                      </span>
                    )}
                  </div>
                </div>

                {/* Building Content */}
                {isExpanded && (
                  <div className="bg-white p-6 border-t">
                    {building.rooms && building.rooms.length > 0 ? (
                      <div className="space-y-4">
                        {building.rooms.map((room) => (
                          <div
                            key={room.room_id}
                            className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {room.room_name || `Room ${room.room_number}`}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {room.room_number && `Room #${room.room_number}`}
                                </p>
                              </div>
                              <div className="text-xs text-slate-600">
                                {room.events?.length || 0} events
                              </div>
                            </div>
                            <div className="h-24 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-sm">
                              14-day grid will render here
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 py-8">
                        No rooms in this building
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}