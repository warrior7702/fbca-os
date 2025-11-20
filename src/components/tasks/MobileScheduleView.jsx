import React, { useState } from 'react';
import { format, addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
import { Clock, Key, MapPin, Video, Users, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function MobileScheduleView({ events, tickets = [], onEventClick, onTicketClick }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Generate 14 days (today + 13 days ahead)
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  
  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventDate = parseISO(event.starts_at);
      return isSameDay(eventDate, day);
    });
  };

  const getTicketsForDay = (day) => {
    return tickets.filter(ticket => {
      if (!ticket.due_date) return false;
      const ticketDate = new Date(ticket.due_date);
      return isSameDay(ticketDate, day);
    });
  };

  const selectedEvents = getEventsForDay(selectedDate);
  const selectedTickets = getTicketsForDay(selectedDate);
  const allItems = [...selectedEvents, ...selectedTickets].sort((a, b) => {
    const aTime = a.starts_at ? new Date(a.starts_at) : new Date(a.due_date);
    const bTime = b.starts_at ? new Date(b.starts_at) : new Date(b.due_date);
    return aTime - bTime;
  });

  const scrollToDay = (date) => {
    const element = document.getElementById(`day-${date.toISOString().split('T')[0]}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const handlePrevDay = () => {
    const currentIndex = days.findIndex(d => isSameDay(d, selectedDate));
    if (currentIndex > 0) {
      const newDate = days[currentIndex - 1];
      setSelectedDate(newDate);
      scrollToDay(newDate);
    }
  };

  const handleNextDay = () => {
    const currentIndex = days.findIndex(d => isSameDay(d, selectedDate));
    if (currentIndex < days.length - 1) {
      const newDate = days[currentIndex + 1];
      setSelectedDate(newDate);
      scrollToDay(newDate);
    }
  };

  return (
    <div className="space-y-4">
      {/* Horizontal Day Strip */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            className="flex-shrink-0 h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 py-2" style={{ scrollbarWidth: 'none' }}>
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const dayEvents = getEventsForDay(day);
              const dayTickets = getTicketsForDay(day);
              const hasItems = dayEvents.length > 0 || dayTickets.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  id={`day-${day.toISOString().split('T')[0]}`}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    flex-shrink-0 w-14 rounded-xl p-2 transition-all
                    ${isSelected 
                      ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg scale-105' 
                      : isToday
                        ? 'bg-green-50 border-2 border-green-500 text-green-700'
                        : 'bg-white border-2 border-slate-200 text-slate-700'
                    }
                  `}
                >
                  <div className="text-[10px] font-medium uppercase">
                    {format(day, 'EEE')}
                  </div>
                  <div className="text-xl font-bold">
                    {format(day, 'd')}
                  </div>
                  {hasItems && (
                    <div className="flex gap-0.5 justify-center mt-1">
                      {[...Array(Math.min(3, dayEvents.length + dayTickets.length))].map((_, i) => (
                        <div 
                          key={i}
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-green-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            className="flex-shrink-0 h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Selected Date Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        <p className="text-sm text-slate-600">
          {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Agenda for Selected Day */}
      <div className="space-y-3">
        {allItems.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <p className="text-slate-500">No events or tasks for this day</p>
          </div>
        ) : (
          allItems.map((item) => {
            const isTicket = !item.starts_at;
            
            if (isTicket) {
              // Render Ticket
              return (
                <div
                  key={`ticket-${item.id}`}
                  onClick={() => onTicketClick?.(item)}
                  className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-l-4 border-purple-500 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                      <Ticket className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-purple-600 text-white text-[10px]">
                          Ticket
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {item.priority}
                        </Badge>
                      </div>
                      <p className="font-semibold text-slate-900 mb-1">{item.subject}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                      {item.category && (
                        <p className="text-xs text-purple-600 mt-1 capitalize">
                          {item.category.replace('_', ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Render Event
            const isMicrosoftMeeting = item.source === 'microsoft';
            const isUnlock = !isMicrosoftMeeting && item.posted_door_code?.toLowerCase() === 'unlock';
            
            return (
              <div
                key={item.id}
                onClick={() => onEventClick?.(item)}
                className={`
                  p-4 rounded-xl border-l-4 cursor-pointer hover:shadow-md transition-all
                  ${isMicrosoftMeeting 
                    ? 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-500' 
                    : isUnlock
                      ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-500'
                      : 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Time Circle */}
                  <div className={`
                    w-14 h-14 rounded-full flex flex-col items-center justify-center flex-shrink-0
                    ${isMicrosoftMeeting 
                      ? 'bg-purple-500' 
                      : isUnlock 
                        ? 'bg-orange-500' 
                        : 'bg-green-500'
                    }
                  `}>
                    <div className="text-white text-[10px] font-medium">
                      {format(parseISO(item.starts_at), 'h:mm')}
                    </div>
                    <div className="text-white text-[9px]">
                      {format(parseISO(item.starts_at), 'a')}
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isMicrosoftMeeting ? (
                        <Badge className="bg-purple-600 text-white text-[10px]">
                          <Video className="w-3 h-3 mr-1" />
                          Meeting
                        </Badge>
                      ) : (
                        <Badge className={`text-white text-[10px] ${isUnlock ? 'bg-orange-600' : 'bg-green-600'}`}>
                          {isUnlock ? 'Unlock' : 'Event'}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="font-semibold text-slate-900 mb-1">{item.name}</p>
                    
                    {/* Microsoft Meeting Info */}
                    {isMicrosoftMeeting && (
                      <div className="space-y-1">
                        {item.location && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </div>
                        )}
                        {item.attendees && item.attendees.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Users className="w-3 h-3" />
                            {item.attendees.length} attendee{item.attendees.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PCO Event Info */}
                    {!isMicrosoftMeeting && (
                      <div className="space-y-1">
                        {item.access_time && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3" />
                            {item.access_time}
                          </div>
                        )}
                        {item.resources && item.resources.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <MapPin className="w-3 h-3" />
                            {item.resources[0].name}
                            {item.resources.length > 1 && ` +${item.resources.length - 1}`}
                          </div>
                        )}
                        {item.posted_door_code && (
                          <div className={`
                            inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold mt-2
                            ${isUnlock 
                              ? 'bg-orange-200 text-orange-900' 
                              : 'bg-green-200 text-green-900 font-mono'
                            }
                          `}>
                            <Key className="w-3 h-3" />
                            {isUnlock ? 'Unlock' : `${item.posted_door_code}#`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}