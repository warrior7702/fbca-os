import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  useEffect(() => {
    // Expand first building by default when data loads
    if (data?.buildings?.length > 0 && Object.keys(expandedBuildings).length === 0) {
      setExpandedBuildings({ [data.buildings[0].building_id]: true });
    }
  }, [data]);

  const loadSetupData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      const result = await base44.functions.invoke('getSetupCalendarEvents', {
        start_date: today.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });
      
      setData(result.data);
    } catch (error) {
      console.error('Error loading setup calendar:', error);
      toast.error('Failed to load setup calendar');
    } finally {
      setLoading(false);
    }
  };

  const toggleBuilding = (buildingId) => {
    setExpandedBuildings(prev => ({
      ...prev,
      [buildingId]: !prev[buildingId]
    }));
  };

  const getFilteredBuildings = () => {
    if (!data?.buildings) return [];
    
    return data.buildings.filter(building => {
      // Building filter
      if (buildingFilter !== 'all' && building.building_id !== buildingFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const buildingMatch = building.building_name.toLowerCase().includes(query);
        const roomMatch = building.rooms.some(room => 
          room.room_name?.toLowerCase().includes(query) || 
          room.room_number?.toLowerCase().includes(query)
        );
        if (!buildingMatch && !roomMatch) return false;
      }
      
      return true;
    });
  };

  const getFilteredRooms = (building) => {
    let rooms = building.rooms;
    
    // Room filter
    if (roomFilter === 'with_events') {
      rooms = rooms.filter(room => room.events.length > 0);
    } else if (roomFilter === 'with_conflicts') {
      rooms = rooms.filter(room => room.conflicts.length > 0);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rooms = rooms.filter(room =>
        room.room_name?.toLowerCase().includes(query) ||
        room.room_number?.toLowerCase().includes(query)
      );
    }
    
    return rooms;
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

      {/* Controls Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 mr-2">View:</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  onClick={() => setViewMode('grid')}
                >
                  2-Week Grid
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'strips' ? 'default' : 'outline'}
                  onClick={() => setViewMode('strips')}
                >
                  Week Strips
                </Button>
              </div>
            </div>

            {/* Row 2: Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  {data.buildings?.map((building) => (
                    <SelectItem key={building.building_id} value={building.building_id}>
                      {building.building_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Rooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  <SelectItem value="with_events">With Events Only</SelectItem>
                  <SelectItem value="with_conflicts">With Conflicts Only</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Building Sections */}
      {getFilteredBuildings().length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No buildings match the current filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {getFilteredBuildings().map((building) => {
            const isExpanded = expandedBuildings[building.building_id];
            const filteredRooms = getFilteredRooms(building);
            
            return (
              <Collapsible
                key={building.building_id}
                open={isExpanded}
                onOpenChange={() => toggleBuilding(building.building_id)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChevronDown 
                            className={`w-5 h-5 text-slate-600 transition-transform ${
                              isExpanded ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <Building2 className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-slate-900">
                            {building.building_name}
                          </h3>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-slate-50">
                            {filteredRooms.length} {filteredRooms.length === 1 ? 'Room' : 'Rooms'}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {building.event_count} {building.event_count === 1 ? 'Event' : 'Events'}
                          </Badge>
                          {building.conflict_count > 0 && (
                            <Badge variant="destructive">
                              {building.conflict_count} {building.conflict_count === 1 ? 'Conflict' : 'Conflicts'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <div className="border-t pt-4">
                        {filteredRooms.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">
                            No rooms match the current filters
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            {/* Calendar Grid */}
                            <div className="min-w-[1200px]">
                              {/* Header Row - 14 Days */}
                              <div className="flex border-b-2 border-slate-300 mb-2">
                                <div className="w-48 flex-shrink-0 p-2 font-semibold text-slate-700">
                                  Room
                                </div>
                                {Array.from({ length: 14 }).map((_, dayOffset) => {
                                  const date = new Date();
                                  date.setDate(date.getDate() + dayOffset);
                                  const dayName = format(date, 'EEE');
                                  const dayNum = format(date, 'd');
                                  return (
                                    <div key={dayOffset} className="flex-1 min-w-[70px] p-2 text-center border-l border-slate-200">
                                      <div className="font-semibold text-slate-700 text-sm">{dayName}</div>
                                      <div className="text-xs text-slate-500">{dayNum}</div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Room Rows */}
                              {filteredRooms.map((room) => {
                                // Group events by day
                                const eventsByDay = {};
                                room.events.forEach(event => {
                                  const eventDate = new Date(event.start_time);
                                  const dayKey = format(eventDate, 'yyyy-MM-dd');
                                  if (!eventsByDay[dayKey]) {
                                    eventsByDay[dayKey] = [];
                                  }
                                  eventsByDay[dayKey].push(event);
                                });

                                return (
                                  <div key={room.room_id} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    {/* Room Name */}
                                    <div className="w-48 flex-shrink-0 p-3 font-medium text-sm text-slate-700 flex items-center">
                                      <div>
                                        <div>{room.room_name}</div>
                                        {room.room_number && (
                                          <div className="text-xs text-slate-500">{room.room_number}</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Day Cells */}
                                    {Array.from({ length: 14 }).map((_, dayOffset) => {
                                      const date = new Date();
                                      date.setDate(date.getDate() + dayOffset);
                                      const dayKey = format(date, 'yyyy-MM-dd');
                                      const dayEvents = eventsByDay[dayKey] || [];
                                      
                                      // Check if any events have conflicts
                                      const hasConflict = room.conflicts.some(conflict => {
                                        const conflict1Date = format(new Date(conflict.event1.start_time), 'yyyy-MM-dd');
                                        const conflict2Date = format(new Date(conflict.event2.start_time), 'yyyy-MM-dd');
                                        return conflict1Date === dayKey || conflict2Date === dayKey;
                                      });

                                      return (
                                        <div key={dayOffset} className="flex-1 min-w-[70px] p-1 border-l border-slate-200">
                                          <div className="space-y-1">
                                            {dayEvents.map((event, idx) => {
                                              const hasEventConflict = room.conflicts.some(conflict =>
                                                conflict.event1.event_id === event.event_id ||
                                                conflict.event2.event_id === event.event_id
                                              );
                                              
                                              return (
                                                <div
                                                  key={idx}
                                                  className={`text-xs p-1 rounded cursor-pointer transition-all ${
                                                    hasEventConflict
                                                      ? 'bg-red-100 border border-red-300 text-red-900 hover:bg-red-200'
                                                      : 'bg-blue-100 border border-blue-300 text-blue-900 hover:bg-blue-200'
                                                  }`}
                                                  title={`${event.event_name}\n${format(new Date(event.start_time), 'h:mm a')} - ${format(new Date(event.end_time), 'h:mm a')}\nSetup: ${event.room_setup.setup_type}`}
                                                >
                                                  <div className="font-semibold truncate">
                                                    {format(new Date(event.start_time), 'h:mm a')}
                                                  </div>
                                                  <div className="truncate text-[10px]">
                                                    {event.event_name.substring(0, 15)}{event.event_name.length > 15 ? '...' : ''}
                                                  </div>
                                                  {hasEventConflict && (
                                                    <AlertTriangle className="w-3 h-3 mt-0.5" />
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}