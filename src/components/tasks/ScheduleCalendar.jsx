import React from 'react';
import { format, startOfWeek, addDays, parseISO, isToday, isPast } from 'date-fns';
import { Key, MapPin, Clock, Video, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ScheduleCalendar({ events = [], meetings = [], weekCount = 2, onEventClick }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  
  // Generate days for the specified number of weeks
  const days = [];
  for (let week = 0; week < weekCount; week++) {
    for (let day = 0; day < 7; day++) {
      days.push(addDays(weekStart, week * 7 + day));
    }
  }

  // Helper to get events for a specific day
  const getEventsForDay = (day) => {
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.starts_at);
      return eventDate.toDateString() === day.toDateString();
    }).map(event => ({
      ...event,
      type: 'pco',
      color: 'green'
    }));

    return dayEvents;
  };

  // Helper to get meetings for a specific day
  const getMeetingsForDay = (day) => {
    const dayMeetings = meetings.filter(meeting => {
      try {
        const meetingDate = parseISO(meeting.start);
        return meetingDate.toDateString() === day.toDateString();
      } catch (error) {
        console.error('Error parsing meeting date:', meeting.start, error);
        return false;
      }
    }).map(meeting => ({
      ...meeting,
      type: 'meeting',
      color: 'purple'
    }));

    return dayMeetings;
  };

  // Combine and sort events and meetings for a day
  const getCombinedItemsForDay = (day) => {
    const pcoEvents = getEventsForDay(day);
    const meetingItems = getMeetingsForDay(day);
    
    const combined = [...pcoEvents, ...meetingItems];
    
    // Sort by start time
    combined.sort((a, b) => {
      const timeA = a.type === 'pco' ? new Date(a.starts_at) : parseISO(a.start);
      const timeB = b.type === 'pco' ? new Date(b.starts_at) : parseISO(b.start);
      return timeA - timeB;
    });
    
    return combined;
  };

  return (
    <div className="space-y-1">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs md:text-sm font-semibold text-slate-600 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const items = getCombinedItemsForDay(day);
          const dayIsToday = isToday(day);
          const dayIsPast = isPast(day) && !dayIsToday;

          return (
            <div
              key={index}
              className={`min-h-24 md:min-h-32 border rounded-lg p-1 md:p-2 transition-all ${
                dayIsToday
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
                  : dayIsPast
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Day Number */}
              <div
                className={`text-xs md:text-sm font-semibold mb-1 ${
                  dayIsToday
                    ? 'bg-blue-600 text-white w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center'
                    : dayIsPast
                    ? 'text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                {format(day, 'd')}
              </div>

              {/* Events and Meetings */}
              <div className="space-y-1">
                {items.slice(0, 3).map((item, idx) => {
                  if (item.type === 'pco') {
                    // PCO Event - Green
                    return (
                      <div
                        key={`pco-${item.id || idx}`}
                        onClick={() => onEventClick && onEventClick(item)}
                        className="group cursor-pointer"
                      >
                        <Card className="p-1.5 md:p-2 bg-green-50 border-green-200 hover:bg-green-100 hover:shadow-md transition-all">
                          <div className="space-y-1">
                            {/* Time and Name */}
                            <div className="flex items-start gap-1">
                              <Clock className="w-3 h-3 text-green-700 mt-0.5 flex-shrink-0 hidden md:block" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] md:text-xs font-semibold text-green-900 line-clamp-1">
                                  {format(new Date(item.starts_at), 'h:mm a')}
                                </p>
                                <p className="text-[9px] md:text-[10px] text-green-700 line-clamp-1 font-medium">
                                  {item.event_name}
                                </p>
                              </div>
                            </div>

                            {/* Resources (rooms) */}
                            {item.resources && item.resources.length > 0 && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-600 flex-shrink-0" />
                                <p className="text-[8px] md:text-[9px] text-green-600 truncate">
                                  {item.resources[0].resource_name}
                                  {item.resources.length > 1 && ` +${item.resources.length - 1}`}
                                </p>
                              </div>
                            )}

                            {/* Door Codes */}
                            {item.door_codes && item.door_codes.length > 0 && (
                              <div className="hidden md:flex items-center gap-1">
                                <Key className="w-2.5 h-2.5 text-green-600 flex-shrink-0" />
                                <p className="text-[8px] text-green-600 font-mono truncate">
                                  {item.door_codes[0].pin}#
                                  {item.door_codes.length > 1 && ` +${item.door_codes.length - 1}`}
                                </p>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    );
                  } else {
                    // Meeting - Purple/Blue
                    return (
                      <div
                        key={`meeting-${item.id || idx}`}
                        onClick={() => onEventClick && onEventClick(item)}
                        className="group cursor-pointer"
                      >
                        <Card className="p-1.5 md:p-2 bg-purple-50 border-purple-200 hover:bg-purple-100 hover:shadow-md transition-all">
                          <div className="space-y-1">
                            {/* Time and Subject */}
                            <div className="flex items-start gap-1">
                              <Video className="w-3 h-3 text-purple-700 mt-0.5 flex-shrink-0 hidden md:block" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] md:text-xs font-semibold text-purple-900 line-clamp-1">
                                  {format(parseISO(item.start), 'h:mm a')}
                                </p>
                                <p className="text-[9px] md:text-[10px] text-purple-700 line-clamp-1 font-medium">
                                  {item.subject}
                                </p>
                              </div>
                            </div>

                            {/* Meeting Type Badge */}
                            {item.meetingLink && (
                              <div className="hidden md:block">
                                <Badge 
                                  variant="outline" 
                                  className="text-[8px] px-1 py-0 h-4 bg-white/50 border-purple-300 text-purple-700"
                                >
                                  <Video className="w-2 h-2 mr-0.5" />
                                  {item.meetingLink.provider === 'Microsoft Teams' ? 'Teams' : 
                                   item.meetingLink.provider === 'Zoom' ? 'Zoom' : 'Meeting'}
                                </Badge>
                              </div>
                            )}

                            {/* Location (if no meeting link) */}
                            {!item.meetingLink && item.location && (
                              <div className="hidden md:flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                                <p className="text-[8px] text-purple-600 truncate">
                                  {item.location}
                                </p>
                              </div>
                            )}

                            {/* Mobile indicator for meeting link */}
                            {item.meetingLink && (
                              <div className="md:hidden">
                                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    );
                  }
                })}

                {/* Show more indicator */}
                {items.length > 3 && (
                  <p className="text-[8px] md:text-[9px] text-slate-500 font-medium pl-1">
                    +{items.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 md:gap-6 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
          <span className="text-xs text-slate-600">PCO Events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Video className="w-3 h-3 text-purple-600" />
          <span className="text-xs text-slate-600">Meetings</span>
        </div>
      </div>
    </div>
  );
}