import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar as CalendarIcon, RefreshCw, Loader2, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
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

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [resourceKinds, setResourceKinds] = useState([]);
  const [eventTags, setEventTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [selectedResourceKind, setSelectedResourceKind] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

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
      
      if (!eventsResponse.data || !eventsResponse.data.events) {
        console.error('No events in response');
        toast.error('Failed to load calendar events');
        setEvents([]);
        setLoading(false);
        return;
      }

      const eventsData = eventsResponse.data.events;
      console.log('✅ Loaded', eventsData.length, 'events');
      
      setEvents(eventsData);
      setLastSync(new Date());

      // Extract unique resource kinds
      const kindsSet = new Set();
      eventsData.forEach(event => {
        if (event.resources && Array.isArray(event.resources)) {
          event.resources.forEach(resource => {
            if (resource.kind) {
              kindsSet.add(resource.kind);
            }
          });
        }
      });
      
      const uniqueKinds = Array.from(kindsSet).sort();
      setResourceKinds(uniqueKinds);

      // Extract unique tags
      const tagsSet = new Set();
      eventsData.forEach(event => {
        if (event.tags && Array.isArray(event.tags)) {
          event.tags.forEach(tag => {
            tagsSet.add(tag);
          });
        }
      });
      
      const uniqueTags = Array.from(tagsSet).sort();
      setEventTags(uniqueTags);

      toast.success(`Loaded ${eventsData.length} events`);
    } catch (error) {
      console.error('Error loading calendar:', error);
      toast.error('Failed to load calendar: ' + (error.message || 'Unknown error'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await loadData();
    setSyncing(false);
  };

  // Filter events by resource kind and tag
  const filteredEvents = events.filter(event => {
    const kindMatch = selectedResourceKind === "all" || 
      event.resources?.some(r => r.kind === selectedResourceKind);
    
    const tagMatch = selectedTag === "all" || 
      event.tags?.includes(selectedTag);
    
    return kindMatch && tagMatch;
  });

  // Calendar grid generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const generateCalendarDays = () => {
    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const getEventsForDay = (day) => {
    return filteredEvents.filter(event => {
      try {
        const eventDate = parseISO(event.starts_at);
        return isSameDay(eventDate, day);
      } catch (error) {
        return false;
      }
    });
  };

  const handleShowAllDayEvents = (day, dayEvents) => {
    setSelectedDate(day);
    setSelectedDayEvents(dayEvents);
  };

  const calendarDays = generateCalendarDays();

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
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && <ConnectionWarning />}

        <AppHeader
          icon={CalendarIcon}
          title="Church Calendar"
          description={
            <div className="flex items-center gap-2">
              <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</span>
              {lastSync && (
                <span className="text-xs text-slate-500">
                  • Last synced: {format(lastSync, 'h:mm a')}
                </span>
              )}
            </div>
          }
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex gap-2 flex-wrap">
              <Select value={selectedResourceKind} onValueChange={setSelectedResourceKind}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Resource Kind" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resource Kinds</SelectItem>
                  {resourceKinds.map(kind => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {eventTags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
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
            </div>
          }
        />

        {events.length === 0 ? (
          <div className="text-center py-20">
            <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Events Found</h3>
            <p className="text-slate-600">
              No upcoming events in Planning Center Calendar
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-2xl font-bold text-slate-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-slate-600 py-2 text-sm">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className={`min-h-32 border border-slate-200 p-2 ${
                      !isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white'
                    } ${isToday ? 'ring-2 ring-blue-500' : ''} hover:bg-slate-50 transition-colors`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${
                      isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          className="text-xs p-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 transition-colors truncate"
                        >
                          {format(parseISO(event.starts_at), 'h:mm a')} {event.name}
                        </motion.div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowAllDayEvents(day, dayEvents);
                          }}
                          className="text-xs text-blue-600 font-medium pl-1 cursor-pointer hover:text-blue-800 hover:underline"
                        >
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day Events List Dialog */}
      <Dialog open={!!selectedDayEvents} onOpenChange={() => setSelectedDayEvents(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <p className="text-slate-600">
              {selectedDayEvents?.length || 0} event{selectedDayEvents?.length !== 1 ? 's' : ''}
            </p>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedDayEvents?.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedDayEvents(null);
                  setSelectedEvent(event);
                }}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all cursor-pointer bg-white hover:bg-blue-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{event.name}</h3>
                    <p className="text-sm text-slate-600 mb-2">
                      {format(parseISO(event.starts_at), 'h:mm a')} - {format(parseISO(event.ends_at), 'h:mm a')}
                    </p>
                    {event.resources && event.resources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {event.resources.map(resource => (
                          <Badge key={resource.id} variant="secondary" className="text-xs">
                            {resource.name} ({resource.kind})
                          </Badge>
                        ))}
                      </div>
                    )}
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedEvent?.name}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600">
                <CalendarIcon className="w-5 h-5" />
                <div>
                  <p className="font-semibold">
                    {format(parseISO(selectedEvent.starts_at), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm">
                    {format(parseISO(selectedEvent.starts_at), 'h:mm a')} - {format(parseISO(selectedEvent.ends_at), 'h:mm a')}
                  </p>
                </div>
              </div>

              {selectedEvent.resources && selectedEvent.resources.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Resources:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.resources.map(resource => (
                      <Badge key={resource.id} variant="secondary">
                        {resource.name} ({resource.kind})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Tags:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.tags.map(tag => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Description:</p>
                  <p className="text-slate-600">{selectedEvent.description}</p>
                </div>
              )}

              <Button
                onClick={() => window.open(`https://calendar.planningcenteronline.com/events/${selectedEvent.event_id}`, '_blank')}
                className="w-full"
              >
                View in Planning Center
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}