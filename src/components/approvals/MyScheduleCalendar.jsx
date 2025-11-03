import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Key, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function MyScheduleCalendar({ approvals }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doorCodes, setDoorCodes] = useState({});
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    // Load door codes for all events
    loadDoorCodes();
  }, [approvals]);

  const loadDoorCodes = async () => {
    if (!approvals || approvals.length === 0) return;
    
    setLoadingCodes(true);
    const codes = {};
    
    // Get unique event IDs
    const eventIds = [...new Set(approvals.map(a => a.event_id))];
    
    // Fetch door codes for each event
    for (const eventId of eventIds) {
      try {
        const response = await base44.functions.invoke('getPCOEventComments', {
          event_id: eventId
        });
        
        if (response.data.latest_door_code) {
          // Extract cardholder name from comment body
          const comments = response.data.comments || [];
          const doorCodeComment = comments.find(c => c.body?.includes('Door Code:'));
          
          codes[eventId] = {
            code: response.data.latest_door_code,
            comment: doorCodeComment?.body || ''
          };
        }
      } catch (error) {
        console.error(`Error loading door code for event ${eventId}:`, error);
      }
    }
    
    setDoorCodes(codes);
    setLoadingCodes(false);
  };

  // Group approvals by event
  const eventMap = {};
  approvals.forEach(approval => {
    if (!eventMap[approval.event_id]) {
      eventMap[approval.event_id] = {
        event_id: approval.event_id,
        event_name: approval.event_name,
        starts_at: approval.event_starts_at,
        ends_at: approval.event_ends_at,
        resources: []
      };
    }
    eventMap[approval.event_id].resources.push({
      name: approval.resource_name,
      group: approval.approval_group_name
    });
  });

  const events = Object.values(eventMap);

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
    return events.filter(event => {
      try {
        const eventDate = parseISO(event.starts_at);
        return isSameDay(eventDate, day);
      } catch (error) {
        return false;
      }
    });
  };

  const calendarDays = generateCalendarDays();

  return (
    <Card>
      <CardContent className="p-6">
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
                } ${isToday ? 'ring-2 ring-green-500' : ''} hover:bg-slate-50 transition-colors`}
              >
                <div className={`text-sm font-semibold mb-1 ${
                  isToday ? 'bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => {
                    const doorCodeInfo = doorCodes[event.event_id];
                    
                    return (
                      <motion.div
                        key={event.event_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs p-2 bg-green-100 border border-green-300 rounded cursor-pointer hover:bg-green-200 transition-colors"
                      >
                        <p className="font-semibold text-green-900 truncate mb-1">
                          {format(parseISO(event.starts_at), 'h:mm a')} {event.event_name}
                        </p>
                        <div className="space-y-1">
                          {event.resources.slice(0, 2).map((resource, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] bg-white border-green-400 text-green-700">
                              {resource.name}
                            </Badge>
                          ))}
                          {event.resources.length > 2 && (
                            <Badge variant="outline" className="text-[10px] bg-white border-green-400 text-green-700">
                              +{event.resources.length - 2} more
                            </Badge>
                          )}
                          {doorCodeInfo && (
                            <div className="mt-2 p-1.5 bg-white rounded border border-green-300">
                              <div className="flex items-center gap-1 mb-1">
                                <Key className="w-3 h-3 text-green-600" />
                                <span className="text-[10px] font-semibold text-green-900">
                                  Code Sent
                                </span>
                              </div>
                              <p className="font-mono text-[11px] font-bold text-green-700">
                                {doorCodeInfo.code}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12">
            <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Events</h3>
            <p className="text-slate-600">
              No events found for your approval groups
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}