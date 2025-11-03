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
  User,
  Loader2,
  RefreshCw,
  Filter,
  Grid3x3,
  List,
  Key,
  FileText,
  ExternalLink
} from "lucide-react";
import { format, parseISO, startOfDay, addDays, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" or "calendar"
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventComments, setEventComments] = useState({});
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

      // Load events
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      const eventsData = eventsResponse.data.events || [];
      setEvents(eventsData);

      // Extract unique resources from events (we'll need to enhance this later)
      // For now, we'll load resources from PCO directly
      await loadResources(currentUser);

      toast.success(`Loaded ${eventsData.length} events`);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async (currentUser) => {
    try {
      // We need to get the PCO token
      const tokenResponse = await base44.functions.invoke('getPCOToken');
      
      if (!tokenResponse.data.ok) {
        console.error('Failed to get PCO token');
        return;
      }

      const accessToken = tokenResponse.data.access_token;

      // Fetch all resources from PCO
      const resourcesResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/resources?per_page=100',
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json();
        const resourcesList = (resourcesData.data || []).map(r => ({
          id: r.id,
          name: r.attributes?.name,
          kind: r.attributes?.kind
        }));
        setResources(resourcesList);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const handleEventClick = async (event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
    setLoadingEventDetails(true);

    // Load event comments to get door codes
    try {
      const commentsResponse = await base44.functions.invoke('getPCOEventComments', {
        event_id: event.id
      });
      
      setEventComments(commentsResponse.data);
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoadingEventDetails(false);
    }
  };

  const filteredEvents = selectedResource === "all" 
    ? events 
    : events.filter(event => {
        // This filtering will need to be enhanced when we add resource data to events
        // For now, showing all events
        return true;
      });

  const groupEventsByDate = () => {
    const grouped = {};
    filteredEvents.forEach(event => {
      const dateKey = format(parseISO(event.starts_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  const renderCalendarView = () => {
    const grouped = groupEventsByDate();
    const sortedDates = Object.keys(grouped).sort();

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-slate-700 py-2">
            {day}
          </div>
        ))}
        
        {/* Calendar cells */}
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
          const date = parseISO(dateKey);
          const dayEvents = grouped[dateKey];

          return (
            <div key={dateKey}>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                {format(date, 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-3">
                {dayEvents.map(event => (
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
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {format(parseISO(event.starts_at), 'h:mm a')} - 
                            {format(parseISO(event.ends_at), 'h:mm a')}
                          </div>
                          {event.approval_status && (
                            <Badge variant={event.approval_status === 'approved' ? 'default' : 'secondary'}>
                              {event.approval_status}
                            </Badge>
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
                ))}
              </div>
            </div>
          );
        })}
        {sortedDates.length === 0 && (
          <div className="text-center py-12">
            <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No events found</p>
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

        {/* Filters */}
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

        {/* Calendar View */}
        {viewMode === 'calendar' ? renderCalendarView() : renderListView()}
      </div>

      {/* Event Detail Modal */}
      <Dialog open={showEventDetail} onOpenChange={setShowEventDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-4">
              {/* Time */}
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

              {/* Door Code */}
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

              {/* Summary */}
              {selectedEvent?.summary && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </h4>
                  <p className="text-slate-600">{selectedEvent.summary}</p>
                </div>
              )}

              {/* Description */}
              {selectedEvent?.description && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}

              {/* Comments/Activity */}
              {eventComments?.comments && eventComments.comments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Activity</h4>
                  <div className="space-y-2">
                    {eventComments.comments.map(comment => (
                      <div key={comment.id} className="bg-slate-50 rounded p-3">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.body}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {comment.created_at && format(parseISO(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View in PCO */}
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