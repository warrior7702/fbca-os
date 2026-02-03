import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, AlertTriangle, Wrench, Settings, MapPin, Clock } from "lucide-react";
import { format, parseISO, addDays, isWithinInterval, startOfDay } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function EventOpsQueue({ onEventClick, roomFilter, dateFilter }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState("all");
  const [dayRangeFilter, setDayRangeFilter] = useState("next_14_days");
  const [rooms, setRooms] = useState([]);
  const [eventsWithSetup, setEventsWithSetup] = useState(new Set());

  useEffect(() => {
    loadEvents();
  }, [dayRangeFilter, roomFilter, dateFilter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const allEvents = await base44.entities.EventOps.list('starts_at');
      
      // Apply day range filter
      const now = new Date();
      let endDate;
      
      if (dayRangeFilter === "today") {
        endDate = addDays(startOfDay(now), 1);
      } else if (dayRangeFilter === "next_3_days") {
        endDate = addDays(now, 3);
      } else {
        endDate = addDays(now, 14);
      }
      
      let filtered = allEvents.filter(event => {
        const eventStart = parseISO(event.starts_at);
        return isWithinInterval(eventStart, {
          start: startOfDay(now),
          end: endDate
        });
      });
      
      // Apply room filter if set
      if (roomFilter) {
        const roomOpsRecords = await base44.entities.RoomOps.filter({ room_pco_resource_id: roomFilter });
        const eventIds = roomOpsRecords.map(r => r.pco_event_id);
        filtered = filtered.filter(e => eventIds.includes(e.pco_event_id));
      }
      
      // Apply date filter if set
      if (dateFilter) {
        const filterDate = startOfDay(new Date(dateFilter));
        const filterDateEnd = addDays(filterDate, 1);
        filtered = filtered.filter(event => {
          const eventStart = parseISO(event.starts_at);
          return isWithinInterval(eventStart, {
            start: filterDate,
            end: filterDateEnd
          });
        });
      }
      
      setEvents(filtered);
      
      // Load rooms for display
      const allRooms = await base44.entities.Room.filter({ is_bookable: true });
      setRooms(allRooms);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEvents = () => {
    if (showFilter === "all") return events;
    if (showFilter === "booked") {
      return events;
    }
    if (showFilter === "room_setup") {
      return events.filter(e => e.needs_room_setup);
    }
    if (showFilter === "maintenance") {
      return events.filter(e => e.needs_maintenance);
    }
    if (showFilter === "alerts") {
      return events.filter(e => 
        e.alert_heavy_usage || 
        e.alert_turnaround_before_cleaning || 
        e.alert_saturday_night_priority
      );
    }
    return events;
  };

  const hasAlerts = (event) => {
    return event.alert_heavy_usage || 
           event.alert_turnaround_before_cleaning || 
           event.alert_saturday_night_priority;
  };

  const filteredEvents = getFilteredEvents();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-600" />
            Ops Queue
            <Badge className="bg-violet-100 text-violet-700 border-violet-300">
              {filteredEvents.length} events
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Select value={dayRangeFilter} onValueChange={setDayRangeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next_3_days">Next 3 Days</SelectItem>
                <SelectItem value="next_14_days">Next 14 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={showFilter} onValueChange={setShowFilter}>
               <SelectTrigger className="w-40">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Booked</SelectItem>
                 <SelectItem value="room_setup">With Setup</SelectItem>
                 <SelectItem value="maintenance">Maintenance</SelectItem>
                 <SelectItem value="alerts">Alerts Only</SelectItem>
               </SelectContent>
             </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No events in selected range
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map(event => {
              const startTime = parseISO(event.starts_at);
              const endTime = parseISO(event.ends_at);
              const progressPercent = event.rooms_count > 0 
                ? Math.round((event.rooms_complete_count / event.rooms_count) * 100)
                : 0;

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                    hasAlerts(event) 
                      ? 'border-amber-400 bg-amber-50' 
                      : 'border-violet-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">
                        {event.event_name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>{format(startTime, 'MMM d, h:mm a')}</span>
                        <span>-</span>
                        <span>{format(endTime, 'h:mm a')}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {event.needs_room_setup && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                          <Wrench className="w-3 h-3 mr-1" />
                          Room Setup
                        </Badge>
                      )}
                      {event.needs_maintenance && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
                          <Settings className="w-3 h-3 mr-1" />
                          Maintenance
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>Progress</span>
                      <span>{event.rooms_complete_count} / {event.rooms_count} rooms complete</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>

                  {/* Alert Badges */}
                  {hasAlerts(event) && (
                    <div className="flex flex-wrap gap-2">
                      {event.alert_heavy_usage && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Heavy Usage
                        </Badge>
                      )}
                      {event.alert_turnaround_before_cleaning && (
                        <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Tight Turnaround
                        </Badge>
                      )}
                      {event.alert_saturday_night_priority && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Weekend Priority
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}