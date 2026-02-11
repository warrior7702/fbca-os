import React from "react";
import { format, isSameDay, parseISO } from "date-fns";

function EventDot({ event }) {
  return (
    <div className="h-1.5 bg-green-500 rounded-full mb-1" title={event.event_name} />
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
  // Filter events occurring on this day
  const eventsOnDay = (room.events || []).filter(event => {
    const eventDate = parseISO(event.start_time);
    const dayDate = parseISO(day.fullDate);
    return isSameDay(eventDate, dayDate);
  });

  // Check if there's a conflict on this day
  const hasConflict = (room.conflicts || []).some(conflict => {
    const conflict1Date = parseISO(conflict.event1.start_time);
    const conflict2Date = parseISO(conflict.event2.start_time);
    const dayDate = parseISO(day.fullDate);
    return isSameDay(conflict1Date, dayDate) || isSameDay(conflict2Date, dayDate);
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
      className={`border-b border-r border-slate-300 p-2 transition-colors hover:bg-slate-100 ${
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