import React from "react";
import { format, isSameDay, parseISO } from "date-fns";

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

  return (
    <div
      className={`border-b border-r border-slate-300 p-2 transition-colors hover:bg-slate-100 ${
        day.isWeekend ? 'bg-pink-50' : 'bg-white'
      }`}
    >
      {/* Empty for now */}
    </div>
  );
}