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
  // DEBUG: Single cell test - only for first day
  const isDebugCell = day.fullDate === '2026-02-11' && room.room_name?.includes('Sanctuary');
  
  if (isDebugCell && room.events && room.events.length > 0) {
    console.log('=== DEBUG CELL ===');
    console.log('Room:', room.room_name);
    console.log('Day:', day.fullDate);
    console.log('Total events in room:', room.events.length);
    console.log('Event Keys:', Object.keys(room.events[0]));
    console.log('First Event:', room.events[0]);
    console.log('Checking fields - start_time:', room.events[0].start_time);
    console.log('Checking fields - starts_at:', room.events[0].starts_at);
    console.log('Checking fields - start:', room.events[0].start);
  }
  
  // Filter events occurring on this day
  const eventsOnDay = (room.events || []).filter(event => {
    if (!event.start_time || !day.fullDate) return false;
    try {
      const eventDate = parseISO(event.start_time);
      const dayDate = parseISO(day.fullDate);
      const matches = isSameDay(eventDate, dayDate);
      
      if (isDebugCell) {
        console.log('Testing event:', event.event_name, 'start_time:', event.start_time, 'matches:', matches);
      }
      
      return matches;
    } catch (e) {
      if (isDebugCell) {
        console.log('Parse error for event:', event.event_name, e);
      }
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

  return (
    <div
      className={`border-b border-r border-slate-300 p-2 min-h-[80px] transition-colors hover:bg-slate-100 flex items-center justify-center ${
        day.isWeekend ? 'bg-pink-50' : 'bg-white'
      }`}
    >
      {eventsOnDay.length > 0 && (
        <div className="text-2xl font-bold text-blue-600">
          {eventsOnDay.length}
        </div>
      )}
    </div>
  );
}