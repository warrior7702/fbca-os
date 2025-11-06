import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, Key, MapPin, Lock } from 'lucide-react';

export default function ScheduleCalendar({ events, weekCount = 2, onEventClick }) {
  const today = new Date();
  const startDate = today;

  const weeks = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(startDate, w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push(addDays(weekStart, d));
    }
    weeks.push(days);
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
          <p className="text-sm font-semibold text-slate-600 mb-3">
            {weekIndex === 0 ? 'This Week' : `Week ${weekIndex + 1}`} • {format(week[0], 'MMM d')} - {format(week[6], 'MMM d')}
          </p>
          <div className="grid grid-cols-7 gap-2">
            {week.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, today);
              const isPast = day < today && !isToday;

              return (
                <div key={dayIndex} className="min-h-[120px]">
                  <div className={`
                    rounded-lg border-2 p-2 h-full
                    ${isToday ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}
                    ${isPast ? 'opacity-50' : ''}
                  `}>
                    <div className="text-center mb-2">
                      <p className="text-xs font-medium text-slate-600">
                        {format(day, 'EEE')}
                      </p>
                      <p className={`text-lg font-bold ${isToday ? 'text-green-700' : 'text-slate-900'}`}>
                        {format(day, 'd')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {dayEvents.map((event) => (
                        <Card 
                          key={event.id} 
                          className="border border-green-200 bg-green-50 hover:shadow-md transition-all cursor-pointer hover:bg-green-100"
                          onClick={() => onEventClick && onEventClick(event)}
                        >
                          <CardContent className="p-2 space-y-1">
                            <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                              {event.name}
                            </p>
                            
                            <div className="flex items-center gap-1 text-[10px] text-slate-600">
                              <Clock className="w-3 h-3 text-green-600" />
                              <span>{format(parseISO(event.starts_at), 'h:mm a')}</span>
                            </div>

                            {event.access_time && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                <Lock className="w-3 h-3 text-green-600" />
                                <span className="line-clamp-1">{event.access_time}</span>
                              </div>
                            )}

                            {event.resources && event.resources.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                <MapPin className="w-3 h-3 text-green-600" />
                                <span className="line-clamp-1">
                                  {event.resources[0].name}
                                  {event.resources.length > 1 && ` +${event.resources.length - 1}`}
                                </span>
                              </div>
                            )}

                            {event.posted_door_code && (
                              <div className="mt-1 p-1 bg-green-200 rounded flex items-center gap-1">
                                <Key className="w-3 h-3 text-green-700" />
                                <span className="text-[10px] font-mono font-bold text-green-700">
                                  {event.posted_door_code}#
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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