
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
  Grid3x3,
  List,
  Key,
  FileText,
  ExternalLink
} from "lucide-react";
import { format, parseISO, startOfDay, addDays } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventComments, setEventComments] = useState({});
  const [eventResources, setEventResources] = useState({});
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);

  useEffect(() => {
    loadData();
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

      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      console.log('📅 Calendar events response:', eventsResponse.data);
      
      const eventsData = eventsResponse.data?.events || [];
      
      // Filter out events with invalid dates
      const validEvents = eventsData.filter(event => {
        const hasValidDates = event.starts_at && event.ends_at;
        if (!hasValidDates) {
          console.warn('⚠️ Skipping event with invalid dates:', event.name);
        }
        return hasValidDates;
      });
      
      setEvents(validEvents);

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

      toast.success(`Loaded ${validEvents.length} events`);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
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
      if (!event.starts_at) return; // Skip events without start date
      
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
    const grouped = groupEventsByDate();

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-slate-700 py-2">
            {day}
          </div>
        ))}
        
        {Array.from({ length: 35 }).map((_, idx) => {
          const date = addDays(startOfDay(new Date()), idx - 7);
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayEvents = grouped[dateKey] || [];

          return (
            <div
              key={idx}
              className="min-h-[100px] bg-white border border-slate-200 rounded-lg p-2"
            >
              <div className="text-xs text-slate-500 mb-1">
                {format(date, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded px-1 py-0.5 cursor-pointer truncate"
                  >
                    {event.name}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-slate-400">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    const grouped = groupEventsByDate();
    const sortedDates = Object.keys(grouped).sort();

    return (
      <div className="space-y-6">
        {sortedDates.map(dateKey => {
          let date;
          try {
            date = parseISO(dateKey);
          } catch (e) {
            console.error(`Error parsing dateKey "${dateKey}":`, e);
            return null; // Skip invalid dates
          }
          
          const dayEvents = grouped[dateKey];

          return (
            <div key={dateKey}>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                {format(date, 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-3">
                {dayEvents.map(event => {
                  const rooms = event.rooms || [];
                  
                  // Safety check for dates
                  if (!event.starts_at || !event.ends_at) {
                    return null;
                  }
                  
                  let startsAt, endsAt;
                  try {
                    startsAt = parseISO(event.starts_at);
                    endsAt = parseISO(event.ends_at);
                  } catch (error) {
                    console.error('Error parsing event dates:', event.name, error);
                    return null;
                  }
                  
                  return (
                    <motion.div
                      key={event.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => handleEventClick(event)}
                      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 mb-2">
                            {event.name}
                          </h4>
                          <div className="flex flex-col gap-1 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {format(startsAt, 'h:mm a')} - {format(endsAt, 'h:mm a')}
                            </div>
                            {rooms.length > 0 && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <MapPin className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">
                                  {rooms.map(r => r.name).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                          {event.summary && (
                            <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                              {event.summary}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="w-5 h-5 text-slate-400" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sortedDates.length === 0 && (
          <div className="text-center py-12">
            <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No events found</p>
            {selectedResource !== "all" && (
              <p className="text-xs text-slate-400 mt-2">
                Try selecting "All Resources" to see all events
              </p>
            )}
          </div>
        )}
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && <ConnectionWarning />}

        <AppHeader
          icon={CalendarIcon}
          title="Calendar"
          description={`${filteredEvents.length} events in the next 2 weeks`}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex items-center gap-2">
              <div className="flex bg-white rounded-lg shadow-sm border border-slate-200">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={viewMode === 'calendar' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                >
                  <Grid3x3 className="w-4 h-4 mr-1" />
                  Calendar
                </Button>
              </div>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
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

        {viewMode === 'calendar' ? renderCalendarView() : renderListView()}
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
