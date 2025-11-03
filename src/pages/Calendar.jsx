import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar as CalendarIcon, RefreshCw, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [selectedResource, setSelectedResource] = useState("all");
  const [currentDate, setCurrentDate] = useState(new Date());

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

      console.log('🔍 Fetching calendar events...');
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      console.log('📅 Full calendar events response:', eventsResponse);
      console.log('📅 Events data:', eventsResponse.data);
      
      if (!eventsResponse.data) {
        console.error('❌ No data in response');
        toast.error('Failed to load calendar data - no response data');
        setEvents([]);
        setLoading(false);
        return;
      }

      const eventsData = eventsResponse.data?.events || [];
      console.log('📅 Events array length:', eventsData.length);
      
      if (eventsData.length > 0) {
        console.log('📅 First few events:', eventsData.slice(0, 3));
      } else {
        console.warn('⚠️ No events returned from API');
      }
      
      // Don't filter - just set all events
      console.log('✅ Setting events in state:', eventsData.length);
      setEvents(eventsData);
      setLastSync(new Date());

      // Extract unique rooms from events
      const roomsSet = new Set();
      eventsData.forEach(event => {
        if (event.rooms && Array.isArray(event.rooms)) {
          event.rooms.forEach(room => {
            roomsSet.add(JSON.stringify({ id: room.id, name: room.name }));
          });
        }
      });
      
      const uniqueRooms = Array.from(roomsSet).map(r => JSON.parse(r));
      console.log('🏠 Unique rooms:', uniqueRooms.length);
      setResources(uniqueRooms);

      if (eventsData.length === 0) {
        toast.info('No upcoming events found in PCO Calendar');
      } else {
        toast.success(`Loaded ${eventsData.length} events`);
      }
    } catch (error) {
      console.error('❌ Error loading calendar data:', error);
      console.error('❌ Error details:', error.response?.data);
      toast.error('Failed to load calendar data: ' + (error.message || 'Unknown error'));
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

  // Filter events by selected resource
  const filteredEvents = selectedResource === "all" 
    ? events 
    : events.filter(event => 
        event.rooms?.some(room => room.id === selectedResource)
      );

  console.log('📊 Rendering with:', {
    totalEvents: events.length,
    filteredEvents: filteredEvents.length,
    selectedResource
  });

  // Group events by date
  const eventsByDate = {};
  filteredEvents.forEach(event => {
    const dateKey = format(new Date(event.starts_at), 'yyyy-MM-dd');
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  const sortedDates = Object.keys(eventsByDate).sort();

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
              <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} in the next 60 days</span>
              {lastSync && (
                <span className="text-xs text-slate-500">
                  • Last synced: {format(lastSync, 'h:mm a')}
                </span>
              )}
            </div>
          }
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex gap-2">
              <Select value={selectedResource} onValueChange={setSelectedResource}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {resources.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
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
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Events for Selected Room</h3>
            <p className="text-slate-600">
              Try selecting a different room or "All Rooms"
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map(dateKey => (
              <div key={dateKey}>
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {eventsByDate[dateKey].map(event => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white rounded-lg border-2 border-blue-200 p-4 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                              {event.name}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
                              <span>
                                {format(new Date(event.starts_at), 'h:mm a')} - {format(new Date(event.ends_at), 'h:mm a')}
                              </span>
                            </div>
                            {event.rooms && event.rooms.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {event.rooms.map(room => (
                                  <Badge key={room.id} variant="secondary">
                                    {room.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {event.description && (
                              <p className="text-sm text-slate-600 mt-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}