
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar as CalendarIcon, RefreshCw, Loader2, Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const [allRooms, setAllRooms] = useState([]);
  const [resourceCategories, setResourceCategories] = useState([]);
  const [eventTags, setEventTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [resourcesExpanded, setResourcesExpanded] = useState(true);

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
      
      // Log stats if available
      if (eventsResponse.data.stats) {
        console.log('📊 Stats:', eventsResponse.data.stats);
        
        // Show warning if many events are missing data
        if (eventsResponse.data.stats.events_without_names > 10) {
          toast.warning(`${eventsResponse.data.stats.events_without_names} events in PCO are missing names`);
        }
      }
      
      setEvents(eventsData);
      setLastSync(new Date());

      // Extract unique rooms and resource categories
      const roomsSet = new Set();
      const categoriesSet = new Set();
      
      eventsData.forEach(event => {
        if (event.resources && Array.isArray(event.resources)) {
          event.resources.forEach(resource => {
            if (resource.kind === 'Room') {
              roomsSet.add(resource.name);
            } else {
              // Use the approval group category
              if (resource.category && resource.category !== 'Uncategorized') {
                categoriesSet.add(resource.category);
              }
            }
          });
        }
      });
      
      const uniqueRooms = Array.from(roomsSet).sort();
      const uniqueCategories = Array.from(categoriesSet).sort();
      
      console.log('🚪 Extracted rooms:', uniqueRooms.length);
      console.log('🔧 Extracted resource categories:', uniqueCategories);
      
      setAllRooms(uniqueRooms);
      setResourceCategories(uniqueCategories);

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

  // Filter events by room search, resource category, and tag
  const filteredEvents = events.filter(event => {
    // Room search filter
    const roomMatch = !roomSearch || 
      event.resources?.some(r => 
        r.kind === 'Room' && 
        r.name.toLowerCase().includes(roomSearch.toLowerCase())
      );
    
    // Resource category filter
    const categoryMatch = selectedCategory === "all" || 
      event.resources?.some(r => 
        r.kind !== 'Room' && 
        r.category === selectedCategory
      );
    
    // Tag filter
    const tagMatch = selectedTag === "all" || 
      event.tags?.includes(selectedTag);
    
    return roomMatch && categoryMatch && tagMatch;
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
              {/* Room Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search rooms..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              {/* Resource Category Dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-600" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      {selectedCategory === "all" ? "All Resources" : selectedCategory}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    {resourceCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tag Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-600" />
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {selectedTag === "all" ? "All Tags" : selectedTag}
                    </SelectValue>
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
              </div>

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
        )}
      </div>

      {/* Day Events List Dialog */}
      <Dialog open={!!selectedDayEvents} onOpenChange={() => setSelectedDayEvents(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" aria-describedby="day-events-description">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <p id="day-events-description" className="text-slate-600 mb-4">
            {selectedDayEvents?.length || 0} event{selectedDayEvents?.length !== 1 ? 's' : ''} scheduled for this day
          </p>
          <div className="space-y-3">
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
                            {resource.name} {resource.category && resource.category !== 'Uncategorized' && `(${resource.category})`}
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" aria-describedby="event-detail-description">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">{selectedEvent?.name}</DialogTitle>
          </DialogHeader>
          <p id="event-detail-description" className="sr-only">
            Full details for {selectedEvent?.name}
          </p>
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

              {/* Resources - COLLAPSIBLE ROOMS AND RESOURCES WITH ANSWERS */}
              {selectedEvent.resources && selectedEvent.resources.length > 0 ? (
                <div className="space-y-4">
                  {/* Rooms Section - Collapsible */}
                  {(() => {
                    const rooms = selectedEvent.resources.filter(r => r.kind === 'Room');
                    if (rooms.length === 0) return null;
                    
                    return (
                      <div>
                        <button
                          onClick={() => setRoomsExpanded(!roomsExpanded)}
                          className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors mb-3 border border-blue-200"
                        >
                          <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Rooms ({rooms.length})
                          </h3>
                          {roomsExpanded ? (
                            <ChevronUp className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-blue-600" />
                          )}
                        </button>
                        
                        {roomsExpanded && (
                          <div className="space-y-2">
                            {rooms.map(resource => (
                              <div key={resource.id} className="p-4 bg-white rounded-lg border border-blue-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-slate-900">{resource.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-500">{resource.kind}</span>
                                      {resource.category && resource.category !== 'Uncategorized' && (
                                        <>
                                          <span className="text-xs text-slate-400">•</span>
                                          <span className="text-xs text-blue-600">{resource.category}</span>
                                        </>
                                      )}
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
                                
                                {/* Resource Answers */}
                                {resource.answers && resource.answers.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-blue-100">
                                    <p className="text-xs font-semibold text-blue-600 mb-2">Details:</p>
                                    <div className="space-y-1">
                                      {resource.answers.map((answer, idx) => (
                                        <div key={idx} className="text-xs">
                                          <span className="text-slate-500">{answer.question}:</span>{' '}
                                          <span className="text-slate-700 font-medium">{answer.answer}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Other Resources Section - Collapsible */}
                  {(() => {
                    const otherResources = selectedEvent.resources.filter(r => r.kind !== 'Room');
                    if (otherResources.length === 0) return null;
                    
                    return (
                      <div>
                        <button
                          onClick={() => setResourcesExpanded(!resourcesExpanded)}
                          className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors mb-3 border border-green-200"
                        >
                          <h3 className="font-semibold text-green-900 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Resources ({otherResources.length})
                          </h3>
                          {resourcesExpanded ? (
                            <ChevronUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-green-600" />
                          )}
                        </button>
                        
                        {resourcesExpanded && (
                          <div className="space-y-2">
                            {otherResources.map(resource => (
                              <div key={resource.id} className="p-4 bg-white rounded-lg border border-green-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-slate-900">{resource.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-500">{resource.kind}</span>
                                      {resource.category && resource.category !== 'Uncategorized' && (
                                        <>
                                          <span className="text-xs text-slate-400">•</span>
                                          <span className="text-xs text-green-600">{resource.category}</span>
                                        </>
                                      )}
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
                                
                                {/* Resource Answers */}
                                {resource.answers && resource.answers.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-green-100">
                                    <p className="text-xs font-semibold text-green-600 mb-2">Details:</p>
                                    <div className="space-y-1">
                                      {resource.answers.map((answer, idx) => (
                                        <div key={idx} className="text-xs">
                                          <span className="text-slate-500">{answer.question}:</span>{' '}
                                          <span className="text-slate-700 font-medium">{answer.answer}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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

