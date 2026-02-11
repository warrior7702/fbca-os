import React from "react";
import { format, isSameDay, parseISO } from "date-fns";

function EventBar({ event, type }) {
  const time = format(parseISO(type === 'setup' ? event.setup_time : event.start_time), 'ha');
  const label = type === 'setup' 
    ? `Setup ${time}` 
    : `${event.event_name.substring(0, 15)}${event.event_name.length > 15 ? '...' : ''} ${time}`;
  
  const bgColor = type === 'setup' ? 'bg-yellow-100' : 'bg-green-100';
  const textColor = type === 'setup' ? 'text-yellow-800' : 'text-green-800';
  const borderColor = type === 'setup' ? 'border-yellow-400' : 'border-green-500';
  
  return (
    <div 
      className={`h-4 ${bgColor} ${textColor} rounded border-l-2 ${borderColor} mb-0.5 px-1 text-[9px] font-medium overflow-hidden whitespace-nowrap text-ellipsis leading-4`}
      title={`${type === 'setup' ? 'Setup: ' : ''}${event.event_name} - ${format(parseISO(type === 'setup' ? event.setup_time : event.start_time), 'h:mm a')}`}
    >
      {label}
    </div>
  );
}

function ConflictBar() {
  return (
    <div className="h-4 bg-red-100 text-red-800 border-l-2 border-red-500 rounded mb-0.5 px-1 text-[9px] font-medium animate-pulse leading-4">
      ⚠️ Gap Issue
    </div>
  );
}

function CountBadge({ count }) {
  return (
    <div className="absolute top-1 right-1 inline-flex items-center justify-center w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full">
      +{count - 3}
    </div>
  );
}

export default function DayCell({ day, room }) {
  // Filter events occurring on this day
  const eventsOnDay = (room.events || []).filter(event => {
    if (!event.start_time || !day.fullDate) return false;
    try {
      const eventDate = parseISO(event.start_time);
      const dayDate = parseISO(day.fullDate);
      return isSameDay(eventDate, dayDate);
    } catch (e) {
      return false;
    }
  });

  // Check if there's a conflict on this day
  const hasConflict = (room.conflicts || []).some(conflict => {
    if (!conflict?.event1?.start_time || !conflict?.event2?.start_time || !day.fullDate) return false;
    try {
      const conflict1Date = parseISO(conflict.event1.start_time);
      const conflict2Date = parseISO(conflict.event2.start_time);
      const dayDate = parseISO(day.fullDate);
      return isSameDay(conflict1Date, dayDate) || isSameDay(conflict2Date, dayDate);
    } catch (e) {
      return false;
    }
  });

  // Log for verification
  console.log(`DayCell [${room.room_name} - ${day.fullDate}]:`, {
    eventsOnDay: eventsOnDay.length,
    hasConflict,
    events: eventsOnDay.map(e => e.event_name)
  });

  // Calculate total items to show (setup + event for each)
  const totalItems = eventsOnDay.length * 2 + (hasConflict ? 1 : 0); // setup + event for each, plus conflict
  const maxVisible = 3;
  const hasMore = totalItems > maxVisible;
  
  // Limit events shown
  const eventsToShow = hasMore ? eventsOnDay.slice(0, 1) : eventsOnDay.slice(0, 2);

  return (
    <div
      className={`relative border-b border-r border-slate-300 p-1 transition-colors hover:bg-slate-100 cursor-pointer min-h-[80px] ${
        day.isWeekend ? 'bg-pink-50' : 'bg-white'
      }`}
    >
      {/* Conflict Bar */}
      {hasConflict && <ConflictBar />}

      {/* Event Bars - Show setup and main event */}
      {eventsToShow.map((event, idx) => (
        <React.Fragment key={idx}>
          {event.setup_time && <EventBar event={event} type="setup" />}
          <EventBar event={event} type="event" />
        </React.Fragment>
      ))}

      {/* Count Badge */}
      {hasMore && <CountBadge count={eventsOnDay.length} />}
    </div>
  );
}