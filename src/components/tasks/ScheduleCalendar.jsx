import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, Key, MapPin, Lock, Unlock, Video, Users, Ticket, CheckCircle2, RepeatIcon } from 'lucide-react';

export default function ScheduleCalendar({ events, tickets = [], deptTasks = [], weekCount = 2, onEventClick, onTicketClick, onDeptTaskClick }) {
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

  const getTicketsForDay = (day) => {
    return tickets.filter(ticket => {
      if (!ticket.due_date) return false;
      // Parse date string properly - handle both date-only and datetime formats
      const dueDateStr = ticket.due_date.split('T')[0];
      const ticketDate = new Date(dueDateStr + 'T12:00:00');
      return isSameDay(ticketDate, day);
    });
  };

  const getDeptTasksForDay = (day) => {
    return deptTasks.filter(task => {
      // Check for various date fields
      const dateStr = task.dueDate || task.due_date || task.nextDueDate;
      if (!dateStr) return false;
      // Parse date string properly - handle both date-only and datetime formats
      const datePart = dateStr.split('T')[0];
      const taskDate = new Date(datePart + 'T12:00:00');
      return isSameDay(taskDate, day);
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
              const dayTickets = getTicketsForDay(day);
              const dayDeptTasks = getDeptTasksForDay(day);
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
                      {dayEvents.map((event) => {
                        // Check if this is a Microsoft meeting
                        const isMicrosoftMeeting = event.source === 'microsoft';
                        
                        // For PCO events
                        const isUnlock = !isMicrosoftMeeting && event.posted_door_code && 
                                       event.posted_door_code.toLowerCase() === 'unlock';
                        
                        // Determine meeting type badge
                        let meetingBadge = null;
                        if (isMicrosoftMeeting) {
                          if (event.meetingLink?.type === 'teams') {
                            meetingBadge = { text: 'Teams', color: 'bg-purple-100 border-purple-300 text-purple-700' };
                          } else if (event.meetingLink?.type === 'zoom') {
                            meetingBadge = { text: 'Zoom', color: 'bg-blue-100 border-blue-300 text-blue-700' };
                          } else {
                            meetingBadge = { text: 'In Person', color: 'bg-slate-100 border-slate-300 text-slate-700' };
                          }
                        }
                        
                        return (
                          <Card 
                            key={event.id} 
                            className={`
                              border transition-all cursor-pointer
                              ${isMicrosoftMeeting 
                                ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:shadow-md' 
                                : isUnlock 
                                  ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 hover:shadow-md' 
                                  : 'border-green-200 bg-green-50 hover:bg-green-100 hover:shadow-md'
                              }
                            `}
                            onClick={() => onEventClick && onEventClick(event)}
                          >
                            <CardContent className="p-2 space-y-1">
                              {/* Event Name */}
                              <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                                {event.name}
                              </p>
                              
                              {/* Time */}
                              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                <Clock className={`w-3 h-3 ${
                                  isMicrosoftMeeting ? 'text-purple-600' : 
                                  isUnlock ? 'text-orange-600' : 'text-green-600'
                                }`} />
                                <span>{format(parseISO(event.starts_at), 'h:mm a')}</span>
                              </div>

                              {/* Building Access Badge - only for PCO events with posted door code */}
                              {!isMicrosoftMeeting && event.posted_door_code && (
                                <Badge variant="outline" className={`text-[9px] ${isUnlock ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                                  Building Access
                                </Badge>
                              )}

                              {/* Microsoft Meeting Indicators */}
                              {isMicrosoftMeeting && (
                                <>
                                  {event.location && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                      <MapPin className="w-3 h-3 text-purple-600" />
                                      <span className="line-clamp-1">{event.location}</span>
                                    </div>
                                  )}
                                  {event.attendees && event.attendees.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                      <Users className="w-3 h-3 text-purple-600" />
                                      <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                  {meetingBadge && (
                                    <Badge variant="outline" className={`text-[9px] ${meetingBadge.color}`}>
                                      {meetingBadge.text}
                                    </Badge>
                                  )}
                                </>
                              )}

                              {/* PCO Event Indicators */}
                              {!isMicrosoftMeeting && (
                                <>
                                  {event.access_time && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                      <Lock className={`w-3 h-3 ${isUnlock ? 'text-orange-600' : 'text-green-600'}`} />
                                      <span className="line-clamp-1">{event.access_time}</span>
                                    </div>
                                  )}

                                  {event.resources && event.resources.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                      <MapPin className={`w-3 h-3 ${isUnlock ? 'text-orange-600' : 'text-green-600'}`} />
                                      <span className="line-clamp-1">
                                        {event.resources[0].name}
                                        {event.resources.length > 1 && ` +${event.resources.length - 1}`}
                                      </span>
                                    </div>
                                  )}

                                  {event.posted_door_code && (
                                    <div className={`
                                      mt-1 p-1 rounded flex items-center gap-1
                                      ${isUnlock 
                                        ? 'bg-gradient-to-r from-orange-200 to-amber-200' 
                                        : 'bg-green-200'
                                      }
                                    `}>
                                      {isUnlock ? (
                                        <Unlock className={`w-3 h-3 ${isUnlock ? 'text-orange-700' : 'text-green-700'}`} />
                                      ) : (
                                        <Key className="w-3 h-3 text-green-700" />
                                      )}
                                      <span className={`
                                        text-[10px] font-bold
                                        ${isUnlock 
                                          ? 'text-orange-700 font-sans' 
                                          : 'text-green-700 font-mono'
                                        }
                                      `}>
                                        {isUnlock ? 'Unlock' : `${event.posted_door_code}#`}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </CardContent>
                          </Card>
                        );
                        })}

                        {/* Tickets */}
                        {dayTickets.map((ticket) => (
                        <Card 
                          key={`ticket-${ticket.id}`} 
                          className="border border-blue-300 bg-blue-50 hover:bg-blue-100 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => onTicketClick && onTicketClick(ticket)}
                        >
                          <CardContent className="p-2 space-y-1">
                            <div className="flex items-center gap-1">
                              <Ticket className="w-3 h-3 text-blue-600" />
                              <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                                {ticket.subject}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[9px] bg-blue-100 border-blue-300 text-blue-700">
                              {ticket.category?.replace('_', ' ') || 'Ticket'}
                            </Badge>
                          </CardContent>
                        </Card>
                        ))}

                        {/* Dept Tasks - Teal/Cyan Color, Routine Tasks - Indigo */}
                        {dayDeptTasks.map((task) => {
                          const isRoutine = task.isRoutine || task.type === 'routine';
                          return (
                            <Card 
                              key={`task-${task.id}`} 
                              className={`border-2 hover:shadow-md transition-all cursor-pointer ${
                                isRoutine 
                                  ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100'
                                  : 'border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100'
                              }`}
                              onClick={() => onDeptTaskClick && onDeptTaskClick(task)}
                            >
                              <CardContent className="p-2 space-y-1">
                                <div className="flex items-center gap-1">
                                  {isRoutine ? (
                                    <RepeatIcon className="w-3 h-3 text-indigo-600" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                  )}
                                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                                    {task.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className={`text-[9px] ${
                                    isRoutine 
                                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                                      : 'bg-teal-100 border-teal-400 text-teal-700'
                                  }`}>
                                    {isRoutine ? task.frequency?.charAt(0).toUpperCase() + task.frequency?.slice(1) : 'Dept Task'}
                                  </Badge>
                                  {task.assigneeName && (
                                    <span className={`text-[9px] truncate ${isRoutine ? 'text-indigo-600' : 'text-teal-600'}`}>
                                      {task.assigneeName}
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
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
          <p className="text-slate-500">No upcoming events</p>
        </div>
      )}
    </div>
  );
}