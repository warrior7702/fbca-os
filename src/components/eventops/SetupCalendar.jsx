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
import CalendarGrid from "./CalendarGrid";

export default function SetupCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBuildings, setExpandedBuildings] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [searchRoom, setSearchRoom] = useState("");

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      console.log('=== SETUP CALENDAR PAGE LOAD ===');
      console.log('Calling getSetupCalendarEvents...');
      
      const response = await base44.functions.invoke("getSetupCalendarEvents", {});
      const result = response.data;
      
      console.log('Raw data received by UI:', result);
      console.log('Summary:', result.summary);
      console.log('Buildings count:', result.buildings?.length);
      console.log('Total events across all buildings (before filtering):', 
        result.buildings?.reduce((sum, b) => 
          sum + b.rooms.reduce((rSum, r) => rSum + (r.events?.length || 0), 0), 0
        )
      );
      
      // FILTER: Only show rooms that have events
      const buildingsWithEvents = result.buildings.map(building => ({
        ...building,
        // Filter to ONLY rooms that have events
        rooms: building.rooms.filter(room => room.events && room.events.length > 0),
        // Update room count to match filtered rooms
        room_count: building.rooms.filter(room => room.events && room.events.length > 0).length,
        event_count: building.rooms
          .filter(room => room.events && room.events.length > 0)
          .reduce((sum, r) => sum + r.events.length, 0)
      }));

      // Only show buildings that have rooms with events
      const filteredBuildings = buildingsWithEvents.filter(b => b.room_count > 0);
      
      console.log('=== AFTER FILTERING ===');
      console.log('Filtered buildings with events:', filteredBuildings.length);
      filteredBuildings.forEach(b => {
        console.log(`  - ${b.building_name}: ${b.room_count} rooms with ${b.event_count} events`);
        b.rooms.forEach(r => {
          console.log(`    - ${r.room_name || r.room_number}: ${r.events.length} events`);
        });
      });
      
      const filteredResult = {
        ...result,
        buildings: filteredBuildings
      };
      
      setData(filteredResult);
      
      // Expand all buildings by default
      const buildingMap = {};
      filteredBuildings.forEach((building) => {
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
                  <div className="bg-white border-t">
                    <CalendarGrid building={building} />
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