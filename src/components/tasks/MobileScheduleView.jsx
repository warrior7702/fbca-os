import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isSameDay, parseISO, isToday } from 'date-fns';
import { Clock, Key, MapPin, Unlock, Users, Ticket, ChevronLeft, ChevronRight, CheckCircle2, RepeatIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function MobileScheduleView({ events, tickets = [], deptTasks = [], onEventClick, onTicketClick, onDeptTaskClick }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);

  // Generate 14 days starting from today
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + (weekOffset * 14)));

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
      if (!task.dueDate && !task.due_date) return false;
      const taskDate = new Date(task.dueDate || task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  const selectedDayEvents = getEventsForDay(selectedDate);
  const selectedDayTickets = getTicketsForDay(selectedDate);
  const selectedDayDeptTasks = getDeptTasksForDay(selectedDate);
  const allItems = [...selectedDayEvents, ...selectedDayTickets, ...selectedDayDeptTasks.map(t => ({ ...t, isDeptTask: true }))].sort((a, b) => {
    const aTime = a.starts_at ? new Date(a.starts_at) : new Date(a.due_date);
    const bTime = b.starts_at ? new Date(b.starts_at) : new Date(b.due_date);
    return aTime - bTime;
  });

  return (
    <div className="space-y-3">
      {/* Horizontal Date Strip */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="h-8 w-8 flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
            {days.map((day, idx) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);
              const dayEvents = getEventsForDay(day);
              const dayTickets = getTicketsForDay(day);
              const dayDeptTasks = getDeptTasksForDay(day);
              const hasItems = dayEvents.length > 0 || dayTickets.length > 0 || dayDeptTasks.length > 0;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    flex-shrink-0 snap-center flex flex-col items-center justify-center
                    w-14 h-16 rounded-lg border-2 transition-all
                    ${isSelected 
                      ? 'border-green-500 bg-green-50 shadow-md' 
                      : isCurrentDay
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-slate-200 bg-white'
                    }
                    ${hasItems && !isSelected ? 'ring-2 ring-blue-200' : ''}
                  `}
                >
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-green-700' : 'text-slate-500'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-lg font-bold ${isSelected ? 'text-green-700' : isCurrentDay ? 'text-green-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasItems && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.length > 0 && (
                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-green-600' : 'bg-blue-500'}`} />
                      )}
                      {dayTickets.length > 0 && (
                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-green-600' : 'bg-purple-500'}`} />
                      )}
                      {dayDeptTasks.length > 0 && (
                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-green-600' : 'bg-teal-500'}`} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="h-8 w-8 flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Selected Day Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-semibold text-slate-900">
          {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {allItems.length} item{allItems.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Agenda List */}
      <div className="space-y-2">
        {allItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">No events or tickets for this day</p>
          </div>
        ) : (
          allItems.map((item) => {
            const isTicket = !!item.ticket_number;
            const isDeptTask = !!item.isDeptTask;
            
            // Dept Task or Routine Task
            if (isDeptTask) {
              const isRoutine = item.isRoutine || item.type === 'routine';
              return (
                <Card 
                  key={`task-${item.id}`} 
                  className={`border-2 active:scale-98 transition-all cursor-pointer ${
                    isRoutine 
                      ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100'
                      : 'border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100'
                  }`}
                  onClick={() => onDeptTaskClick && onDeptTaskClick(item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {isRoutine ? (
                        <RepeatIcon className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
                          {item.title}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-[10px] ${
                            isRoutine 
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                              : 'bg-teal-100 border-teal-400 text-teal-700'
                          }`}>
                            {isRoutine ? item.frequency?.charAt(0).toUpperCase() + item.frequency?.slice(1) : 'Dept Task'}
                          </Badge>
                          {item.assigneeName && (
                            <Badge variant="outline" className={`text-[10px] ${
                              isRoutine ? 'border-indigo-300 text-indigo-600' : 'border-teal-300 text-teal-600'
                            }`}>
                              {item.assigneeName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            
            if (isTicket) {
              return (
                <Card 
                  key={`ticket-${item.id}`} 
                  className="border border-blue-300 bg-blue-50 hover:bg-blue-100 active:scale-98 transition-all"
                  onClick={() => onTicketClick && onTicketClick(item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Ticket className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
                          {item.subject}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px] bg-blue-100 border-blue-300 text-blue-700">
                            {item.category?.replace('_', ' ') || 'Ticket'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Event
            const isMicrosoftMeeting = item.source === 'microsoft';
            const isUnlock = !isMicrosoftMeeting && item.posted_door_code?.toLowerCase() === 'unlock';
            
            return (
              <Card 
                key={item.id} 
                className={`
                  border transition-all active:scale-98
                  ${isMicrosoftMeeting 
                    ? 'border-purple-300 bg-purple-50 hover:bg-purple-100' 
                    : isUnlock 
                      ? 'border-orange-300 bg-orange-50 hover:bg-orange-100' 
                      : 'border-green-200 bg-green-50 hover:bg-green-100'
                  }
                `}
                onClick={() => onEventClick && onEventClick(item)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Time */}
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${
                      isMicrosoftMeeting ? 'text-purple-600' : 
                      isUnlock ? 'text-orange-600' : 'text-green-600'
                    }`} />
                    <span className="text-sm font-medium text-slate-900">
                      {format(parseISO(item.starts_at), 'h:mm a')}
                    </span>
                  </div>

                  {/* Building Access Badge - only for PCO events with posted door code */}
                  {!isMicrosoftMeeting && item.posted_door_code && (
                    <Badge variant="outline" className={`text-[10px] w-fit ${isUnlock ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                      Building Access
                    </Badge>
                  )}

                  {/* Event Name */}
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {item.name}
                  </p>

                  {/* Microsoft Meeting Details */}
                  {isMicrosoftMeeting && (
                    <div className="space-y-1">
                      {item.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="w-3 h-3 text-purple-600" />
                          <span className="line-clamp-1">{item.location}</span>
                        </div>
                      )}
                      {item.attendees && item.attendees.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Users className="w-3 h-3 text-purple-600" />
                          <span>{item.attendees.length} attendee{item.attendees.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PCO Event Details */}
                  {!isMicrosoftMeeting && (
                    <div className="space-y-1">
                      {item.access_time && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Clock className={`w-3 h-3 ${isUnlock ? 'text-orange-600' : 'text-green-600'}`} />
                          <span>{item.access_time}</span>
                        </div>
                      )}
                      {item.resources && item.resources.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className={`w-3 h-3 ${isUnlock ? 'text-orange-600' : 'text-green-600'}`} />
                          <span className="line-clamp-1">
                            {item.resources[0].name}
                            {item.resources.length > 1 && ` +${item.resources.length - 1}`}
                          </span>
                        </div>
                      )}
                      {item.posted_door_code && (
                        <div className={`
                          p-2 rounded flex items-center gap-2
                          ${isUnlock 
                            ? 'bg-gradient-to-r from-orange-200 to-amber-200' 
                            : 'bg-green-200'
                          }
                        `}>
                          {isUnlock ? (
                            <Unlock className="w-4 h-4 text-orange-700" />
                          ) : (
                            <Key className="w-4 h-4 text-green-700" />
                          )}
                          <span className={`
                            text-sm font-bold
                            ${isUnlock ? 'text-orange-700' : 'text-green-700 font-mono'}
                          `}>
                            {isUnlock ? 'Unlock' : `${item.posted_door_code}#`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}