
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/shared/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  Filter,
  Key,
  FileText,
  ExternalLink
} from "lucide-react";
import { format, parseISO, startOfDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [selectedResource, setSelectedResource] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventComments, setEventComments] = useState({});
  const [eventResources, setEventResources] = useState({});
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      handleSync();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.pco_access_token) {
        toast.error('Please connect Planning Center in Settings');
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching calendar events...');
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      console.log('📅 Full calendar events response:', eventsResponse);
      console.log('📅 Events data:', eventsResponse.data);
      
      const eventsData = eventsResponse.data?.events || [];
      console.log('📅 Events array length:', eventsData.length);
      console.log('📅 First few events:', eventsData.slice(0, 3));
      
      // Filter out events with invalid dates
      const validEvents = eventsData.filter(event => {
        const hasValidDates = event.starts_at && event.ends_at;
        if (!hasValidDates) {
          console.warn('⚠️ Skipping event with invalid dates:', event.name, event);
        }
        return hasValidDates;
      });
      
      console.log('✅ Valid events count:', validEvents.length);
      
      setEvents(validEvents);
      setLastSync(new Date());

      const roomsSet = new Set();
      validEvents.forEach(event => {
        if (event.rooms && Array.isArray(event.rooms)) {
          event.rooms.forEach(room => {
            roomsSet.add(JSON.stringify({ id: room.id, name: room.name }));
          });
        }
      });
      
      const uniqueRooms = Array.from(roomsSet).map(r => JSON.parse(r));
      setResources(uniqueRooms);

      if (validEvents.length === 0) {
        toast.info('No upcoming events found in PCO Calendar');
      } else {
        toast.success(`Loaded ${validEvents.length} events`);
      }
    } catch (error) {
      console.error('❌ Error loading calendar data:', error);
      console.error('❌ Error details:', error.response?.data);
      toast.error('Failed to load calendar data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const currentUser = await base44.auth.me();
      
      if (!currentUser.pco_access_token) {
        toast.error('Please connect Planning Center in Settings');
        return;
      }

      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      const eventsData = eventsResponse.data?.events || [];
      
      const validEvents = eventsData.filter(event => {
        return event.starts_at && event.ends_at;
      });
      
      setEvents(validEvents);
      setLastSync(new Date());

      const roomsSet = new Set();
      validEvents.forEach(event => {
        if (event.rooms && Array.isArray(event.rooms)) {
          event.rooms.forEach(room => {
            roomsSet.add(JSON.stringify({ id: room.id, name: room.name }));
          });
        }
      });
      
      const uniqueRooms = Array.from(roomsSet).map(r => JSON.parse(r));
      setResources(uniqueRooms);

      toast.success(`Synced ${validEvents.length} events from PCO`);
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar: ' + (error.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleEventClick = async (event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
    setLoadingEventDetails(true);

    try {
      const [commentsResponse, resourcesResponse] = await Promise.all([
        base44.functions.invoke('getPCOEventComments', { event_id: event.id }),
        base44.functions.invoke('getPCOEventResources', { event_id: event.id })
      ]);
      
      setEventComments(commentsResponse.data || {});
      setEventResources(prev => ({ ...prev, [event.id]: resourcesResponse.data || {} }));
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoadingEventDetails(false);
    }
  };

  const filteredEvents = selectedResource === "all" 
    ? events 
    : events.filter(event => {
        return event.rooms && event.rooms.some(room => room.id === selectedResource);
      });

  const groupEventsByDate = () => {
    const grouped = {};
    filteredEvents.forEach(event => {
      if (!event.starts_at) return;
      
      try {
        const dateKey = format(parseISO(event.starts_at), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      } catch (error) {
        console.error('Error parsing date for event:', event.name, error);
      }
    });
    return grouped;
  };

  const renderCalendarView = () => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const grouped = groupEventsByDate();

    // Generate 6 weeks (42 days) starting from beginning of current week
    const totalDays = 42;
    const startDate = weekStart;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Calendar Header - Days of Week */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="text-center font-semibold text-slate-700 py-3 text-sm border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalDays }).map((_, idx) => {
            const date = addDays(startDate, idx);
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayEvents = grouped[dateKey] || [];
            const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
            const isCurrentMonth = date.getMonth() === today.getMonth();

            return (
              <div
                key={idx}
                className={`min-h-[120px] p-2 border-r border-b border-slate-200 ${
                  !isCurrentMonth ? 'bg-slate-50' : ''
                } ${isToday ? 'bg-blue-50' : ''}`}
              >
                <div className={`text-sm font-medium mb-2 ${
                  isToday ? 'text-blue-600' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {format(date, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => {
                    const rooms = event.rooms || [];
                    return (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-900 rounded px-2 py-1 cursor-pointer truncate transition-colors"
                        title={event.name}
                      >
                        <div className="font-medium truncate">{event.name}</div>
                        {rooms.length > 0 && (
                          <div className="text-blue-700 text-[10px] truncate mt-0.5">
                            {rooms.map(r => r.name).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-slate-500 px-2">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const currentEventResources = selectedEvent ? eventResources[selectedEvent.id] : null;

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 overflow-auto">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {!user?.pco_access_token && <ConnectionWarning />}

        <AppHeader
          icon={CalendarIcon}
          title="Church Calendar"
          description={
            <div className="flex items-center gap-2">
              <span>{filteredEvents.length} events in the next 60 days</span>
              {lastSync && (
                <span className="text-xs text-slate-500">
                  • Last synced: {format(lastSync, 'h:mm a')}
                </span>
              )}
            </div>
          }
          iconColor="from-blue-500 to-indigo-500"
          action={
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync from PCO
                </>
              )}
            </Button>
          }
        />

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-slate-500" />
              <Select value={selectedResource} onValueChange={setSelectedResource}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filter by resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {resources.map(resource => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {renderCalendarView()}
      </div>

      <Dialog open={showEventDetail} onOpenChange={setShowEventDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              {selectedEvent?.name}
            </DialogTitle>
          </DialogHeader>

          {loadingEventDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-5 h-5 text-slate-400" />
                <span>
                  {selectedEvent && format(parseISO(selectedEvent.starts_at), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="pl-7 text-slate-600">
                {selectedEvent && format(parseISO(selectedEvent.starts_at), 'h:mm a')} - 
                {selectedEvent && format(parseISO(selectedEvent.ends_at), 'h:mm a')}
              </div>

              {currentEventResources?.resource_requests?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      Rooms & Resources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentEventResources.rooms?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Rooms</p>
                        {currentEventResources.rooms.map((room, idx) => (
                          <div key={idx} className="ml-4 mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-slate-800">{room.resource_name}</span>
                              {room.approval_status && (
                                <Badge variant={room.approval_status === 'A' ? 'default' : 'secondary'} className="text-xs">
                                  {room.approval_status === 'A' ? 'Approved' : room.approval_status === 'P' ? 'Pending' : 'Denied'}
                                </Badge>
                              )}
                            </div>
                            {room.answers?.length > 0 && (
                              <div className="ml-6 mt-2 space-y-1">
                                {room.answers.map((qa, qaIdx) => (
                                  <div key={qaIdx} className="text-sm">
                                    <span className="text-slate-600">{qa.question}:</span>
                                    <span className="ml-2 text-slate-900 font-medium">{qa.answer}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {currentEventResources.resource_requests?.filter(r => r.resource_kind !== 'Room').length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Resources not in a room</p>
                        {currentEventResources.resource_requests
                          .filter(r => r.resource_kind !== 'Room')
                          .map((resource, idx) => (
                            <div key={idx} className="ml-4 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600">•</span>
                                <span className="font-medium text-slate-800">{resource.resource_name}</span>
                                {resource.approval_status && (
                                  <Badge variant={resource.approval_status === 'A' ? 'default' : 'secondary'} className="text-xs">
                                    {resource.approval_status === 'A' ? 'Approved' : resource.approval_status === 'P' ? 'Pending' : 'Denied'}
                                  </Badge>
                                )}
                              </div>
                              {resource.answers?.length > 0 && (
                                <div className="ml-6 mt-2 space-y-1">
                                  {resource.answers.map((qa, qaIdx) => (
                                    <div key={qaIdx} className="text-sm">
                                      <span className="text-slate-600">{qa.question}:</span>
                                      <span className="ml-2 text-slate-900 font-medium">{qa.answer}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {eventComments?.latest_door_code && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-green-800">
                      <Key className="w-4 h-4" />
                      Building Access Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-bold text-green-700">
                      {eventComments.latest_door_code}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedEvent?.summary && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </h4>
                  <p className="text-slate-600">{selectedEvent.summary}</p>
                </div>
              )}

              {selectedEvent?.description && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}

              {eventComments?.comments?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {eventComments.comments.map(comment => (
                        <div key={comment.id} className="border-l-2 border-blue-200 pl-4 py-2">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.body}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {comment.created_at && format(parseISO(comment.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => window.open(`https://calendar.planningcenteronline.com/events/${selectedEvent?.id}`, '_blank')}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Planning Center
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
