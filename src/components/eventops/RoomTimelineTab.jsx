import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function RoomTimelineTab() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [eventRooms, setEventRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      loadTimeline();
    }
  }, [selectedRoomId]);

  const loadRooms = async () => {
    try {
      const roomsData = await base44.entities.Room.list();
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const allEventRooms = await base44.entities.PCO_EventRoom.filter({ room_id: selectedRoomId });
      
      // Sort by setup_allowed_from
      const sorted = allEventRooms.sort((a, b) => 
        new Date(a.setup_allowed_from) - new Date(b.setup_allowed_from)
      );
      
      setEventRooms(sorted);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const checkOverlap = (eventRoom, index) => {
    if (index === 0) return false;
    
    const prevEvent = eventRooms[index - 1];
    const setupStart = new Date(eventRoom.setup_allowed_from);
    const prevTeardown = prevEvent.teardown_due_by ? new Date(prevEvent.teardown_due_by) : new Date(prevEvent.setup_due_by);
    
    return setupStart < prevTeardown;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Room</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRoomId || ""} onValueChange={setSelectedRoomId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a room..." />
            </SelectTrigger>
            <SelectContent>
              {rooms.map(room => (
                <SelectItem key={room.id} value={room.id}>
                  {room.room_number ? `${room.room_number} - ${room.room_name || 'Unnamed'}` : room.room_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedRoomId && (
        <>
          {loadingTimeline ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
          ) : eventRooms.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
                  
                  <div className="space-y-6">
                    {eventRooms.map((eventRoom, index) => {
                      const hasOverlap = checkOverlap(eventRoom, index);
                      const setupStart = new Date(eventRoom.setup_allowed_from);
                      const setupDeadline = new Date(eventRoom.setup_due_by);
                      const teardownDeadline = eventRoom.teardown_due_by ? new Date(eventRoom.teardown_due_by) : null;

                      return (
                        <div key={eventRoom.id} className="relative pl-12">
                          {/* Timeline dot */}
                          <div className={`absolute left-5 top-2 w-3 h-3 rounded-full border-2 ${
                            hasOverlap ? 'bg-red-500 border-red-500' : 'bg-violet-500 border-violet-500'
                          }`} />
                          
                          <Card className={`${hasOverlap ? 'border-2 border-red-400 bg-red-50' : ''}`}>
                            <CardContent className="p-4">
                              {hasOverlap && (
                                <div className="flex items-center gap-2 mb-2 text-red-700 text-xs font-medium">
                                  <AlertTriangle className="w-4 h-4" />
                                  Setup window overlaps with previous event!
                                </div>
                              )}
                              
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                  <p className="font-semibold text-slate-900">{eventRoom.room_name_text}</p>
                                  <p className="text-xs text-slate-500 mt-1">Instance: {eventRoom.pco_event_instance_id}</p>
                                </div>
                              </div>

                              {/* Setup Window */}
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                                <p className="text-xs font-semibold text-blue-900 mb-1">Setup Window</p>
                                <div className="flex items-center gap-2 text-xs text-blue-700">
                                  <Clock className="w-3 h-3" />
                                  <span>{format(setupStart, 'MMM d, h:mm a')}</span>
                                  <span>→</span>
                                  <span>{format(setupDeadline, 'h:mm a')}</span>
                                </div>
                              </div>

                              {/* Teardown */}
                              {teardownDeadline && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-orange-900 mb-1">Teardown Deadline</p>
                                  <div className="flex items-center gap-2 text-xs text-orange-700">
                                    <Clock className="w-3 h-3" />
                                    <span>{format(teardownDeadline, 'MMM d, h:mm a')}</span>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No upcoming events for this room</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}