import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function SetupCalendar() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [expandedRooms, setExpandedRooms] = useState({});

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getSetupCalendarEvents', {});
      setData(result.data);
    } catch (error) {
      console.error('Error loading setup calendar:', error);
      toast.error('Failed to load setup calendar');
    } finally {
      setLoading(false);
    }
  };

  const toggleRoom = (roomId) => {
    setExpandedRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
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
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{data.summary.total_events}</div>
            <div className="text-sm text-slate-600">Total Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{data.summary.active_rooms}</div>
            <div className="text-sm text-slate-600">Active Rooms</div>
          </CardContent>
        </Card>
        <Card className={data.summary.total_conflicts > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{data.summary.total_conflicts}</div>
            <div className="text-sm text-slate-600">Setup Conflicts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-600">Date Range</div>
            <div className="text-xs text-slate-500">
              {format(parseISO(data.summary.date_range.start), 'MMM d')} - {format(parseISO(data.summary.date_range.end), 'MMM d')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buildings */}
      {data.buildings.map((building) => (
        <Card key={building.building_id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{building.building_name}</CardTitle>
                <div className="flex gap-4 mt-2 text-sm text-slate-600">
                  <span>{building.room_count} rooms</span>
                  <span>{building.event_count} events</span>
                  {building.conflict_count > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {building.conflict_count} conflicts
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {building.rooms.map((room) => (
                <div key={room.room_id} className="border rounded-lg">
                  {/* Room Header */}
                  <button
                    onClick={() => toggleRoom(room.room_id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {room.room_name} {room.room_number && `(${room.room_number})`}
                        </div>
                        <div className="text-sm text-slate-600">
                          {room.events.length} events
                          {room.conflicts.length > 0 && (
                            <span className="ml-2 text-red-600 font-medium">
                              • {room.conflicts.length} conflicts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedRooms[room.room_id] ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Room Details */}
                  {expandedRooms[room.room_id] && (
                    <div className="border-t bg-slate-50 p-4 space-y-3">
                      {/* Conflicts */}
                      {room.conflicts.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Setup/Teardown Conflicts
                          </div>
                          {room.conflicts.map((conflict, idx) => (
                            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                              <div className="font-semibold text-red-900 mb-2">
                                Conflict: {conflict.shortage_minutes} minutes short
                              </div>
                              <div className="space-y-1 text-slate-700">
                                <div>
                                  <span className="font-medium">Event 1:</span> {conflict.event1.event_name}
                                  <div className="text-xs text-slate-600 ml-4">
                                    Ends: {format(parseISO(conflict.event1.end_time), 'h:mm a')} + {conflict.event1.teardown_minutes}min teardown
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium">Event 2:</span> {conflict.event2.event_name}
                                  <div className="text-xs text-slate-600 ml-4">
                                    Starts: {format(parseISO(conflict.event2.start_time), 'h:mm a')} - {conflict.event2.setup_minutes}min setup needed
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-red-300 flex items-center gap-2 text-xs">
                                  <Clock className="w-3 h-3" />
                                  Gap: {conflict.gap_minutes}min | Required: {conflict.required_minutes}min
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Events */}
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Scheduled Events
                        </div>
                        {room.events.map((event, idx) => (
                          <div key={idx} className="bg-white border rounded-lg p-3 text-sm">
                            <div className="font-semibold text-slate-900">{event.event_name}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              {format(parseISO(event.start_time), 'MMM d, h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                Setup: {event.room_setup.setup_time_minutes}min
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Teardown: {event.room_setup.teardown_time_minutes}min
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}