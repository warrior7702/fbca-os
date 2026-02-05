import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Calendar, Clock, ArrowRight, CalendarDays, Building2, CheckSquare, Search, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SetupCalendar() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'strips'
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBuildings, setExpandedBuildings] = useState({});

  useEffect(() => {
    loadSetupData();
  }, []);

  const loadSetupData = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getSetupCalendarEvents', {});
      setData(result.data);
      
      if (result.data.buildings.length > 0) {
        setSelectedBuilding(result.data.buildings[0].building_id);
      }
    } catch (error) {
      console.error('Error loading setup calendar:', error);
      toast.error('Failed to load setup calendar');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-600">
        No data available
      </div>
    );
  }

  const currentBuilding = data.buildings.find(b => b.building_id === selectedBuilding);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Events - Green */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-700">{data.summary.total_events}</div>
                <p className="text-sm text-green-600">Total Events</p>
              </div>
              <CalendarDays className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Setup Conflicts - Red */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-700">{data.summary.total_conflicts}</div>
                <p className="text-sm text-red-600">Setup Conflicts</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Rooms - Blue */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-700">{data.summary.active_rooms}</div>
                <p className="text-sm text-blue-600">Active Rooms</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Setup Tasks - Gray */}
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-700">{data.summary.total_events * 2}</div>
                <p className="text-sm text-slate-600">Setup Tasks</p>
              </div>
              <CheckSquare className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Building Selector */}
      {data.buildings.length > 1 && (
        <div className="flex gap-2">
          {data.buildings.map(building => (
            <Button
              key={building.building_id}
              variant={selectedBuilding === building.building_id ? 'default' : 'outline'}
              onClick={() => setSelectedBuilding(building.building_id)}
            >
              {building.building_name}
              {building.conflict_count > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {building.conflict_count}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Building Details */}
      {currentBuilding && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {currentBuilding.building_name}
            </h3>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>{currentBuilding.room_count} rooms</span>
              <span>{currentBuilding.event_count} events</span>
              {currentBuilding.conflict_count > 0 && (
                <span className="text-red-600 font-medium">
                  {currentBuilding.conflict_count} conflicts
                </span>
              )}
            </div>
          </div>

          {/* Rooms */}
          <div className="space-y-4">
            {currentBuilding.rooms.map(room => (
              <Card key={room.room_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {room.room_name} {room.room_number && `(${room.room_number})`}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{room.events.length} events</Badge>
                      {room.conflicts.length > 0 && (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {room.conflicts.length} conflicts
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Events Timeline */}
                  <div className="space-y-3">
                    {room.events.map((event, idx) => (
                      <div key={idx} className="border-l-2 border-blue-200 pl-4 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{event.event_name}</div>
                            <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(event.start_time), 'MMM d, h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              Setup: {event.room_setup.setup_time_minutes}min • Teardown: {event.room_setup.teardown_time_minutes}min
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conflicts */}
                  {room.conflicts.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="text-sm font-semibold text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Setup/Teardown Conflicts
                      </div>
                      {room.conflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-red-900">
                              Conflict #{idx + 1}
                            </span>
                            <Badge variant="destructive">
                              {conflict.shortage_minutes} min short
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <div className="text-slate-700">{conflict.event1.event_name}</div>
                              <div className="text-xs text-slate-600">
                                Ends: {format(new Date(conflict.event1.end_time), 'h:mm a')} 
                                <span className="text-red-600 ml-2">
                                  + {conflict.event1.teardown_minutes}min teardown
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <ArrowRight className="w-4 h-4" />
                              <span className="text-xs">
                                Gap: {conflict.gap_minutes} min (need {conflict.required_minutes} min)
                              </span>
                            </div>
                            <div>
                              <div className="text-slate-700">{conflict.event2.event_name}</div>
                              <div className="text-xs text-slate-600">
                                <span className="text-red-600">
                                  {conflict.event2.setup_minutes}min setup + 
                                </span>
                                {' '}Starts: {format(new Date(conflict.event2.start_time), 'h:mm a')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}