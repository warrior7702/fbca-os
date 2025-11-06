
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar as CalendarIcon, RefreshCw, Loader2, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [currentDayIndex, setCurrentDayIndex] = useState(0); // For mobile carousel

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
      console.log('📊 Sample event:', eventsData[0]);
      
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
      console.log('🔧 Extracted resource kinds:', uniqueKinds);
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
      console.log('🏷️ Extracted tags:', uniqueTags);
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

  console.log(`📊 Total: ${events.length}, Filtered: ${filteredEvents.length}, Month: ${format(currentMonth, 'MMMM yyyy')}`);

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
    const dayEvents = filteredEvents.filter(event => {
      try {
        const eventDate = parseISO(event.starts_at);
        const match = isSameDay(eventDate, day);
        return match;
      } catch (error) {
        console.error('Error parsing event date:', event.starts_at, error);
        return false;
      }
    });
    
    return dayEvents;
  };

  const handleShowAllDayEvents = (day, dayEvents) => {
    setSelectedDate(day);
    setSelectedDayEvents(dayEvents);
  };

  const calendarDays = generateCalendarDays();

  // Mobile carousel navigation
  const nextDay = () => {
    if (currentDayIndex < calendarDays.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  const prevDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const renderMobileDayCard = (day, dayIndex) => {
    const dayEvents = getEventsForDay(day);
    const isCurrentMonth = isSameMonth(day, currentMonth);
    const isToday = isSameDay(day, new Date());

    return (
      <div
        key={dayIndex}
        className={`rounded-lg border-2 p-4 h-full min-h-[400px] ${
          isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
        } ${!isCurrentMonth ? 'opacity-60' : ''}`}
      >
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-slate-600">
            {format(day, 'EEEE')}
          </p>
          <p className={`text-3xl font-bold ${isToday ? 'text-blue-700' : 'text-slate-900'}`}>
            {format(day, 'd')}
          </p>
          <p className="text-sm text-slate-500">{format(day, 'MMMM yyyy')}</p>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[300px]">
          {dayEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No events</p>
            </div>
          ) : (
            dayEvents.map((event) => (
              <Card
                key={event.id}
                className="border border-blue-200 bg-blue-50 hover:shadow-md transition-all cursor-pointer hover:bg-blue-100"
                onClick={() => setSelectedEvent(event)}
              >
                <CardContent className="p-3 space-y-2">
                  <p className="font-semibold text-slate-900 text-sm">
                    {event.name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {format(parseISO(event.starts_at), 'h:mm a')} - {format(parseISO(event.ends_at), 'h:mm a')}
                  </p>
                  {event.resources && event.resources.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.resources.slice(0, 2).map(resource => (
                        <Badge key={resource.id} variant="secondary" className="text-xs">
                          {resource.name}
                        </Badge>
                      ))}
                      {event.resources.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{event.resources.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
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
          <>
            {/* Mobile Carousel View */}
            <div className="block md:hidden bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevDay}
                  disabled={currentDayIndex === 0}
                  className="h-10 w-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Day {currentDayIndex + 1} of {calendarDays.length}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextDay}
                  disabled={currentDayIndex === calendarDays.length - 1}
                  className="h-10 w-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentDayIndex}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderMobileDayCard(calendarDays[currentDayIndex], currentDayIndex)}
                </motion.div>
              </AnimatePresence>

              {/* Day Dots Indicator */}
              <div className="flex justify-center gap-1 mt-4 overflow-x-auto py-2">
                {calendarDays.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentDayIndex(idx)}
                    className={`h-2 rounded-full transition-all flex-shrink-0 ${
                      idx === currentDayIndex
                        ? 'bg-blue-600 w-6'
                        : 'bg-slate-300 w-2'
                    }`}
                  />
                ))}
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentMonth(subMonths(currentMonth, 1));
                    setCurrentDayIndex(0);
                  }}
                >
                  Previous Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setCurrentDayIndex(0);
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentMonth(addMonths(currentMonth, 1));
                    setCurrentDayIndex(0);
                  }}
                >
                  Next Month
                </Button>
              </div>
            </div>

            {/* Desktop Calendar Grid View */}
            <div className="hidden md:block bg-white rounded-xl shadow-lg p-6">
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
                      transition={{ delay: index * 0.005 }}
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
          </>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">{selectedEvent?.name}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-6">
              {/* Date & Time */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <CalendarIcon className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 mb-1">
                    {format(parseISO(selectedEvent.starts_at), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-slate-600">
                    {format(parseISO(selectedEvent.starts_at), 'h:mm a')} - {format(parseISO(selectedEvent.ends_at), 'h:mm a')}
                  </p>
                </div>
              </div>

              {/* Summary - strip HTML */}
              {selectedEvent.summary && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Summary</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{stripHtml(selectedEvent.summary)}</p>
                </div>
              )}

              {/* Description - strip HTML */}
              {selectedEvent.description && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Description</p>
                  <p className="text-slate-600 whitespace-pre-wrap">{stripHtml(selectedEvent.description)}</p>
                </div>
              )}

              {/* Resources */}
              {selectedEvent.resources && selectedEvent.resources.length > 0 ? (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-semibold text-green-900 mb-3">
                    Rooms & Resources ({selectedEvent.resources.length})
                  </p>
                  <div className="space-y-2">
                    {selectedEvent.resources.map(resource => (
                      <div key={resource.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{resource.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{resource.kind}</span>
                            {resource.approval_status && (
                              <>
                                <span className="text-xs text-slate-400">•</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    resource.approval_status === 'A' ? 'bg-green-50 border-green-300 text-green-700' : 
                                    resource.approval_status === 'P' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 
                                    'bg-red-50 border-red-300 text-red-700'
                                  }`}
                                >
                                  {resource.approval_status === 'A' ? 'Approved' : 
                                   resource.approval_status === 'P' ? 'Pending' : 
                                   resource.approval_status === 'R' ? 'Rejected' : 'Unknown'}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No rooms or resources requested</p>
                </div>
              )}

              {/* Tags */}
              {selectedEvent.tags && selectedEvent.tags.length > 0 ? (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-semibold text-purple-900 mb-3">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="bg-white border-purple-300 text-purple-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No tags</p>
                </div>
              )}

              {/* Event Status */}
              <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                <div>
                  <span className="font-medium">Approval Status: </span>
                  <Badge 
                    className={
                      selectedEvent.approval_status === 'A' ? 'bg-green-100 text-green-700 border-green-300' : 
                      selectedEvent.approval_status === 'P' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 
                      'bg-slate-100 text-slate-700'
                    }
                  >
                    {selectedEvent.approval_status === 'A' ? 'Approved' : 
                     selectedEvent.approval_status === 'P' ? 'Pending' : 
                     selectedEvent.approval_status === 'R' ? 'Rejected' : 'Unknown'}
                  </Badge>
                </div>
                {selectedEvent.visible_in_church_center !== undefined && (
                  <div>
                    <span className="font-medium">Church Center: </span>
                    <span>{selectedEvent.visible_in_church_center ? 'Visible' : 'Hidden'}</span>
                  </div>
                )}
              </div>

              {/* Debug Info */}
              <details className="p-3 bg-slate-100 rounded text-xs">
                <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">
                  Debug Info
                </summary>
                <pre className="mt-2 overflow-auto text-[10px]">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </details>

              <Button
                onClick={() => window.open(`https://calendar.planningcenteronline.com/events/${selectedEvent.event_id}`, '_blank')}
                className="w-full bg-blue-600 hover:bg-blue-700"
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
