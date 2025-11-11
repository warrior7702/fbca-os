import React from 'react';
import { format, startOfWeek, addDays, parseISO, isToday, isPast } from 'date-fns';
import { Key, MapPin, Clock, Video, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function ScheduleCalendar({ events = [], meetings = [], weekCount = 1, onEventClick }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  
  const days = [];
  for (let week = 0; week < weekCount; week++) {
    for (let day = 0; day < 7; day++) {
      days.push(addDays(weekStart, week * 7 + day));
    }
  }

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

  const getCombinedItemsForDay = (day) => {
    const pcoEvents = getEventsForDay(day);
    const meetingItems = getMeetingsForDay(day);
    
    const combined = [...pcoEvents, ...meetingItems];
    
    combined.sort((a, b) => {
      const timeA = a.type === 'pco' ? new Date(a.starts_at) : parseISO(a.start);
      const timeB = b.type === 'pco' ? new Date(b.starts_at) : parseISO(b.start);
      return timeA - timeB;
    });
    
    return combined;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-3">
        {days.map((day, index) => {
          const items = getCombinedItemsForDay(day);
          const dayIsToday = isToday(day);
          const dayIsPast = isPast(day) && !dayIsToday;

          return (
            <div key={index} className="flex flex-col">
              <div className={`text-center mb-2 py-2 rounded-lg ${
                dayIsToday ? 'bg-green-100' : 'bg-slate-50'
              }`}>
                <div className="text-xs font-medium text-slate-600">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-bold ${
                  dayIsToday ? 'text-green-700' : 'text-slate-900'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {items.map((item, idx) => {
                  if (item.type === 'pco') {
                    return (
                      <Card
                        key={`pco-${item.id || idx}`}
                        onClick={() => onEventClick && onEventClick(item)}
                        className="p-3 bg-white border-l-4 border-green-500 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                            {item.event_name}
                          </h3>
                          
                          <div className="flex items-center gap-1 text-xs text-green-700">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(item.starts_at), 'h:mm a')}</span>
                          </div>

                          {item.resources && item.resources.length > 0 && (
                            <div className="flex items-start gap-1 text-xs text-green-700">
                              <Building2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">
                                {item.resources[0].resource_name}
                                {item.resources.length > 1 && ` +${item.resources.length - 1}`}
                              </span>
                            </div>
                          )}

                          {item.door_codes && item.door_codes.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-green-700 font-mono">
                              <Key className="w-3 h-3" />
                              <span>
                                {item.door_codes[0].pin}#
                                {item.door_codes.length > 1 && ` +${item.door_codes.length - 1}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  } else {
                    return (
                      <Card
                        key={`meeting-${item.id || idx}`}
                        onClick={() => onEventClick && onEventClick(item)}
                        className="p-3 bg-white border-l-4 border-purple-500 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                            {item.subject}
                          </h3>
                          
                          <div className="flex items-center gap-1 text-xs text-purple-700">
                            <Clock className="w-3 h-3" />
                            <span>{format(parseISO(item.start), 'h:mm a')}</span>
                          </div>

                          {item.meetingLink && (
                            <div className="flex items-center gap-1 text-xs text-purple-700">
                              <Video className="w-3 h-3" />
                              <span>{item.meetingLink.provider === 'Microsoft Teams' ? 'Teams' : item.meetingLink.provider}</span>
                            </div>
                          )}

                          {!item.meetingLink && item.location && (
                            <div className="flex items-center gap-1 text-xs text-purple-700">
                              <MapPin className="w-3 h-3" />
                              <span className="line-clamp-1">{item.location}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}