
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, Key, MapPin } from 'lucide-react';
import { motion } from 'framer-motion'; // Added motion from framer-motion

export default function ScheduleCalendar({ events, weekCount = 2 }) {
  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 0 }); // Start on Sunday

  const weeks = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(startDate, w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push(addDays(weekStart, d));
    }
    weeks.push({
      start: days[0], // The first day of the week
      end: days[6],   // The last day of the week
      days: days      // The array of all days in the week
    });
  }

  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventDate = parseISO(event.starts_at);
      return isSameDay(eventDate, day);
    });
  };

  return (
    <div className="space-y-6">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Week {weekIndex + 1} • {format(week.start, 'MMM d')} - {format(week.end, 'MMM d')}
            </h3>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {week.days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'); // Using 'today' instead of 'now' from outline

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[140px] rounded-lg border-2 p-2 ${
                    isToday
                      ? 'border-green-400 bg-green-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold ${
                        isToday ? 'text-green-600' : 'text-slate-900'
                      }`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    {dayEvents.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <a
                        key={event.id} // Retained event.id as per existing structure
                        href={`https://calendar.planningcenteronline.com/resource_approvals?filter=pending`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          className={`text-xs p-1.5 rounded ${
                            event.posted_door_code
                              ? 'bg-green-100 border border-green-300'
                              : 'bg-blue-100 border border-blue-300'
                          } hover:shadow-sm transition-shadow cursor-pointer`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <Clock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span className="text-slate-700 font-medium truncate">
                              {format(parseISO(event.starts_at), 'h:mm a')}
                            </span>
                          </div>
                          <p className="text-slate-900 font-medium text-[11px] leading-tight line-clamp-2 mb-1">
                            {event.name}
                          </p>
                          {event.resources && event.resources.length > 0 && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                              <span className="text-[10px] text-slate-600 truncate">
                                {event.resources[0].name}
                              </span>
                            </div>
                          )}
                          {event.posted_door_code && (
                            <div className="flex items-center gap-1 mt-1 pt-1 border-t border-green-200">
                              <Key className="w-2.5 h-2.5 text-green-600 flex-shrink-0" />
                              <span className="text-[10px] text-green-700 font-mono font-semibold">
                                {event.posted_door_code}#
                              </span>
                            </div>
                          )}
                        </motion.div>
                      </a>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-center text-slate-500 py-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-500">No upcoming events with your approval groups</p>
        </div>
      )}
    </div>
  );
}
