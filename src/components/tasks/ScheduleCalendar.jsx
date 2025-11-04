
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, Key, MapPin, X, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ScheduleCalendar({ events = [], weekCount = 2 }) {
  const [expandedEvent, setExpandedEvent] = useState(null);

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 0 }); // Start on Sunday

  const weeks = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(startDate, w * 7);
    const weekEnd = addDays(weekStart, 6); // Last day of the week
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push(addDays(weekStart, d));
    }
    weeks.push({ start: weekStart, end: weekEnd, days: days });
  }

  return (
    <div className="space-y-4">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="bg-slate-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Week {weekIndex + 1} • {format(week.start, 'MMM d')} - {format(week.end, 'MMM d')}
          </h3>
          
          <div className="grid grid-cols-7 gap-2">
            {week.days.map((day, dayIndex) => {
              const dayEvents = events.filter(event => {
                const eventDate = new Date(event.starts_at);
                return (
                  eventDate.getFullYear() === day.getFullYear() &&
                  eventDate.getMonth() === day.getMonth() &&
                  eventDate.getDate() === day.getDate()
                );
              });

              const isToday = 
                day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();

              return (
                <div 
                  key={dayIndex} 
                  className={`min-h-[100px] rounded-lg border-2 p-2 ${
                    isToday 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 ${
                    isToday ? 'text-green-700' : 'text-slate-600'
                  }`}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold mb-2 ${
                    isToday ? 'text-green-700' : 'text-slate-900'
                  }`}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setExpandedEvent(expandedEvent?.id === event.id ? null : event)}
                        className={`w-full text-left p-1.5 rounded text-xs transition-all ${
                          event.posted_door_code
                            ? 'bg-green-100 hover:bg-green-200 border border-green-300'
                            : 'bg-blue-100 hover:bg-blue-200 border border-blue-300'
                        }`}
                      >
                        <div className="flex items-start gap-1">
                          {event.posted_door_code ? (
                            <Key className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {event.name}
                            </p>
                            <p className="text-[10px] text-slate-600">
                              {format(new Date(event.starts_at), 'h:mm a')}
                            </p>
                            {event.posted_door_code && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-[10px] font-semibold text-green-700">
                                  Code: {event.posted_door_code}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Event Detail Modal */}
      <AnimatePresence>
        {expandedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setExpandedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {expandedEvent.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {format(new Date(expandedEvent.starts_at), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedEvent(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Door Code Display */}
              {expandedEvent.posted_door_code && (
                <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Building Access Code</h4>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-2xl font-mono font-bold text-green-700 text-center">
                      {expandedEvent.posted_door_code}
                    </p>
                  </div>
                  {/* Note: The outline provided 'posted_by' but 'event.posted_by' might not exist in the original data structure. */}
                  {expandedEvent.posted_door_code && ( // Using posted_door_code as a proxy for existence for now
                    <p className="text-xs text-slate-600 mt-2 text-center">
                      Posted by PCO Admin
                    </p>
                  )}
                </div>
              )}

              {/* Resources */}
              {expandedEvent.resources && expandedEvent.resources.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Resources</h4>
                  <div className="space-y-1">
                    {expandedEvent.resources.map((resource, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{resource.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <a
                  href={`https://api.planningcenteronline.com/calendar/v2/events/${expandedEvent.id}`} {/* Assuming event.id maps to the URL */}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View in PCO
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
