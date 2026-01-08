import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  Loader2,
  MapPin,
  Wrench,
  Settings,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { format, parseISO, addDays, isWithinInterval, startOfDay } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function UpcomingEventOps() {
  const [eventOpsItems, setEventOpsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventIds, setExpandedEventIds] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    loadEventOpsItems();
  }, []);

  const loadEventOpsItems = async () => {
    setLoading(true);
    try {
      // Get events for next 14 days
      const now = new Date();
      const fourteenDaysLater = addDays(now, 14);
      
      const allItems = await base44.entities.EventOpsItem.list();
      
      // Filter for next 14 days and sort by starts_at
      const upcomingItems = allItems
        .filter(item => {
          const startDate = parseISO(item.starts_at);
          return isWithinInterval(startDate, {
            start: startOfDay(now),
            end: fourteenDaysLater
          });
        })
        .sort((a, b) => parseISO(a.starts_at) - parseISO(b.starts_at));
      
      setEventOpsItems(upcomingItems);
    } catch (error) {
      console.error('Error loading event ops items:', error);
      toast.error('Failed to load upcoming events');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (eventId) => {
    setExpandedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const markStatusDone = async (item, statusField) => {
    try {
      const updateData = {};
      updateData[statusField] = 'done';
      
      await base44.entities.EventOpsItem.update(item.id, updateData);
      
      // Update local state
      setEventOpsItems(prev => prev.map(evt => 
        evt.id === item.id ? { ...evt, [statusField]: 'done' } : evt
      ));
      
      toast.success(`${statusField === 'status_setup' ? 'Setup' : 'Maintenance'} marked as done!`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-300' },
      in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-300' },
      done: { label: 'Done', className: 'bg-green-100 text-green-700 border-green-300' }
    };
    
    return config[status] || config.pending;
  };

  // Group events by date
  const groupedByDate = eventOpsItems.reduce((groups, item) => {
    const dateKey = format(parseISO(item.starts_at), 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {});

  const sortedDateKeys = Object.keys(groupedByDate).sort();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading upcoming events...</p>
        </CardContent>
      </Card>
    );
  }

  if (eventOpsItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-600" />
            Upcoming Event Ops (Next 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">No events scheduled in the next 14 days</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-violet-600" />
          Upcoming Event Ops (Next 14 Days)
          <Badge className="bg-violet-100 text-violet-700 border-violet-300 ml-2">
            {eventOpsItems.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedDateKeys.map(dateKey => {
            const dateEvents = groupedByDate[dateKey];
            const displayDate = parseISO(dateKey);
            
            return (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-semibold">
                    {format(displayDate, 'EEEE, MMM d')}
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Events for this date */}
                <div className="space-y-3">
                  {dateEvents.map(item => {
                    const isExpanded = expandedEventIds.includes(item.id);
                    const startTime = parseISO(item.starts_at);
                    const endTime = parseISO(item.ends_at);
                    
                    const setupBadge = getStatusBadge(item.status_setup);
                    const maintenanceBadge = getStatusBadge(item.status_maintenance);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-2 border-violet-200 rounded-lg bg-white overflow-hidden"
                      >
                        {/* Event Header */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 text-base mb-2">
                                {item.pco_event_name}
                              </h3>
                              
                              {/* Time Window */}
                              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                                <Clock className="w-4 h-4" />
                                <span>{format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}</span>
                              </div>

                              {/* Room Badges */}
                              {item.rooms && item.rooms.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                  <MapPin className="w-4 h-4 text-slate-400" />
                                  {item.rooms.map((room, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {room.name || room.room_name || 'Room'}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {/* Status Badges & Quick Actions */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {item.setup_required && (
                                  <div className="flex items-center gap-2">
                                    <Wrench className="w-4 h-4 text-blue-500" />
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${setupBadge.className}`}
                                    >
                                      Setup: {setupBadge.label}
                                    </Badge>
                                    {item.status_setup !== 'done' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => markStatusDone(item, 'status_setup')}
                                        className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Mark Done
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {item.maintenance_required && (
                                  <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-orange-500" />
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${maintenanceBadge.className}`}
                                    >
                                      Maintenance: {maintenanceBadge.label}
                                    </Badge>
                                    {item.status_maintenance !== 'done' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => markStatusDone(item, 'status_maintenance')}
                                        className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Mark Done
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Expand Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(item.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Details Section */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-violet-200 bg-violet-50/30"
                            >
                              <div className="p-4 space-y-4">
                                {/* Setup Details */}
                                {item.setup_required && item.setup_details && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Wrench className="w-4 h-4 text-blue-600" />
                                      <p className="text-sm font-semibold text-blue-900">Setup Details</p>
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                      {item.setup_details}
                                    </p>
                                  </div>
                                )}

                                {/* Maintenance Details */}
                                {item.maintenance_required && item.maintenance_details && (
                                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Settings className="w-4 h-4 text-orange-600" />
                                      <p className="text-sm font-semibold text-orange-900">Maintenance Details</p>
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                      {item.maintenance_details}
                                    </p>
                                  </div>
                                )}

                                {/* No details message */}
                                {(!item.setup_details && !item.maintenance_details) && (
                                  <p className="text-sm text-slate-500 text-center py-2">
                                    No additional details available
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}