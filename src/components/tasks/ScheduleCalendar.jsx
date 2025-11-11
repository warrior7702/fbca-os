import React from "react";
import { format, parseISO, startOfWeek, addDays, isSameDay, isPast, isToday } from "date-fns";
import { Video, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ScheduleCalendar({ events, onEventClick, weeksToShow = 2 }) {
  const startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
  const days = [];

  for (let i = 0; i < weeksToShow * 7; i++) {
    days.push(addDays(startDate, i));
  }

  const getEventsForDay = (day) => {
    return events.filter((event) => {
      try {
        const eventDate = parseISO(event.starts_at);
        return isSameDay(eventDate, day);
      } catch (error) {
        return false;
      }
    });
  };

  // Helper to determine event type color
  const getEventColor = (event) => {
    if (event.type === 'meeting') {
      return 'bg-purple-100 border-purple-300 text-purple-900';
    }
    return 'bg-blue-100 border-blue-300 text-blue-900';
  };

  // Helper to get event icon
  const getEventIcon = (event) => {
    if (event.type === 'meeting') {
      if (event.meetingLink) {
        return <Video className="w-3 h-3" />;
      }
      return <CalendarIcon className="w-3 h-3" />;
    }
    return null;
  };

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-lg">
        <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No scheduled events in the next {weeksToShow} weeks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentDay = isToday(day);
          const isPastDay = isPast(day) && !isCurrentDay;

          return (
            <div
              key={index}
              className={`min-h-32 border rounded-lg p-2 ${
                isCurrentDay
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400"
                  : isPastDay
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200"
              }`}
            >
              {/* Day Header */}
              <div className="text-center mb-2">
                <p className="text-xs text-slate-500 font-medium">
                  {format(day, "EEE")}
                </p>
                <p
                  className={`text-lg font-bold ${
                    isCurrentDay
                      ? "text-blue-600"
                      : isPastDay
                      ? "text-slate-400"
                      : "text-slate-900"
                  }`}
                >
                  {format(day, "d")}
                </p>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.map((event, idx) => {
                  const startTime = format(parseISO(event.starts_at), "h:mm a");
                  const isUnlockEvent = event.resources?.some(r => 
                    r.name?.toLowerCase().includes('unlock')
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => onEventClick(event)}
                      className={`text-xs p-2 rounded border cursor-pointer hover:shadow-md transition-all ${getEventColor(event)}`}
                    >
                      <div className="flex items-start gap-1 mb-1">
                        {getEventIcon(event)}
                        <p className="font-semibold line-clamp-2 flex-1">
                          {event.name}
                        </p>
                      </div>
                      
                      <p className="text-xs opacity-75 mb-1">
                        {startTime}
                      </p>

                      {/* Meeting Location/Link Badge */}
                      {event.type === 'meeting' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {event.meetingLink && (
                            <Badge className="text-[10px] px-1 py-0 bg-green-500 text-white">
                              {event.meetingLink.provider}
                            </Badge>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 text-[10px] opacity-75">
                              <MapPin className="w-2 h-2" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PCO Event Info */}
                      {event.type === 'pco_event' && (
                        <>
                          {event.resources && event.resources.length > 0 && (
                            <div className="space-y-0.5 mt-1">
                              {event.resources.slice(0, 2).map((resource, ridx) => (
                                <div
                                  key={ridx}
                                  className={`text-[10px] px-1 py-0.5 rounded ${
                                    isUnlockEvent
                                      ? "bg-green-200 text-green-900 font-semibold"
                                      : "bg-white/50"
                                  }`}
                                >
                                  📍 {resource.name}
                                </div>
                              ))}
                              {event.resources.length > 2 && (
                                <div className="text-[10px] opacity-75">
                                  +{event.resources.length - 2} more
                                </div>
                              )}
                            </div>
                          )}

                          {event.access_time && (
                            <div className="text-[10px] mt-1 px-1 py-0.5 bg-green-200 text-green-900 rounded font-semibold">
                              🔑 Access: {event.access_time}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}