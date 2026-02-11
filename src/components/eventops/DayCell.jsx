import React from "react";
import { format, isSameDay, parseISO } from "date-fns";

function EventDot({ event }) {
  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const timeStr = formatTime(event.start_time);
  const label = `${event.event_name}${timeStr ? ' ' + timeStr : ''}`;

  return (
    <div 
      className="w-full h-4 bg-green-100 border-l-2 border-green-500 rounded-sm mb-1 px-1 flex items-center overflow-hidden"
      title={label}
    >
      <span className="text-[9px] font-medium text-green-800 truncate leading-none">
        {label}
      </span>
    </div>
  );
}

function ConflictDot() {
  return (
    <div className="h-1.5 bg-red-500 rounded-full mb-1 animate-pulse" title="Conflict detected" />
  );
}

function CountBadge({ count }) {
  return (
    <div className="inline-flex items-center justify-center px-1.5 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-full">
      +{count - 3}
    </div>
  );
}

export default function DayCell({ day, room }) {
  // DEBUG: Log event structure once to identify correct datetime field
  if (room.events && room.events.length > 0 && !window.__eventStructureLogged) {
    console.log('=== EVENT STRUCTURE DEBUG ===');
    console.log('First event object:', JSON.stringify(room.events[0], null, 2));
    console.log('Available datetime fields:');
    console.log('  start_time:', room.events[0].start_time);
    console.log('  starts_at:', room.events[0].starts_at);
    console.log('  date:', room.events[0].date);
    console.log('  All keys:', Object.keys(room.events[0]));
    window.__eventStructureLogged = true;
  }
  
  // Defensive: find the correct datetime field
  const getEventDateTime = (event) => {
    return event.start_time || event.starts_at || event.date;
  };
  
  // Filter events occurring on this day
  const eventsOnDay = (room.events || []).filter(event => {
    const eventDateTime = getEventDateTime(event);
    if (!eventDateTime || !day.fullDate) return false;
    try {
      const eventDate = parseISO(eventDateTime);
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

  const eventsToShow = eventsOnDay.slice(0, 3);
  const hasMoreEvents = eventsOnDay.length > 3;

  return (
    <div
      className={`border-b border-r border-slate-300 p-2 min-h-[80px] transition-colors hover:bg-slate-100 ${
        day.isWeekend ? 'bg-pink-50' : 'bg-white'
      }`}
    >
      {/* Conflict Bar */}
      {hasConflict && <ConflictDot />}

      {/* Event Bars */}
      {eventsToShow.map((event, idx) => (
        <EventDot key={idx} event={event} />
      ))}

      {/* Count Badge */}
      {hasMoreEvents && <CountBadge count={eventsOnDay.length} />}
    </div>
  );
}