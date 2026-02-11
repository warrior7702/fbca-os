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
  
  // Find the correct datetime field
  let dateField = null;
  if (room.events && room.events.length > 0) {
    const firstEvent = room.events[0];
    
    if (isDebugCell) {
      console.log('=== DEFENSIVE CHECK ===');
      console.log('Room:', room.room_name, 'Day:', day.fullDate);
      console.log('Total events:', room.events.length);
      console.log('First event keys:', Object.keys(firstEvent));
      console.log('First event:', JSON.stringify(firstEvent, null, 2));
    }
    
    // Detect which field contains the datetime
    if (firstEvent.start_time) {
      dateField = 'start_time';
    } else if (firstEvent.starts_at) {
      dateField = 'starts_at';
    } else if (firstEvent.date) {
      dateField = 'date';
    } else {
      // Last resort - find any ISO date-like string
      for (const [key, value] of Object.entries(firstEvent)) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          dateField = key;
          break;
        }
      }
    }
    
    if (isDebugCell) {
      console.log('Detected dateField:', dateField);
    }
  }
  
  // Filter events occurring on this day
  const eventsOnDay = (room.events || []).filter(event => {
    if (!dateField || !event[dateField] || !day.fullDate) return false;
    
    try {
      const eventDate = parseISO(event[dateField]);
      const dayDate = parseISO(day.fullDate);
      const matches = isSameDay(eventDate, dayDate);
      
      if (isDebugCell) {
        console.log(`Event "${event.event_name}" | room_id: ${room.room_id} | day: ${day.fullDate} | dateField: "${dateField}" = "${event[dateField]}" | matches: ${matches}`);
      }
      
      return matches;
    } catch (e) {
      if (isDebugCell) {
        console.log(`Parse error - event: ${event.event_name}, field: ${dateField}, value: ${event[dateField]}, error:`, e.message);
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