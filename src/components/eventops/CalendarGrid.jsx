import React, { useMemo } from "react";

export default function CalendarGrid({ building }) {
  // Calculate 14-day date range
  const days = useMemo(() => {
    const today = new Date();
    const dateArray = [];

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      dateArray.push({
        dateNum: date.getDate(),
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        fullDate: date,
      });
    }

    return dateArray;
  }, []);

  if (!building.rooms || building.rooms.length === 0) {
    return <p className="text-center text-slate-500 py-8">No rooms in this building</p>;
  }

  return (
    <div className="overflow-x-auto -mx-6 -mb-6">
      <style>{`
        .calendar-grid {
          display: grid;
          grid-template-columns: 140px repeat(14, 1fr);
          gap: 2px;
          background: #e0e0e0;
          min-width: max-content;
          padding: 15px;
        }

        .room-label-header {
          background: #34495e;
          color: white;
          padding: 15px 10px;
          font-weight: 600;
          position: sticky;
          left: 0;
          z-index: 10;
          text-align: left;
          font-size: 12px;
        }

        .date-header {
          background: #34495e;
          color: white;
          padding: 10px 5px;
          text-align: center;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .date-header.weekend-header {
          background: #e74c3c;
        }

        .date-num {
          font-size: 16px;
          font-weight: 700;
        }

        .date-day {
          font-size: 9px;
          opacity: 0.8;
        }

        .room-label-cell {
          background: #f8f9fa;
          padding: 10px;
          font-weight: 600;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: sticky;
          left: 0;
          z-index: 5;
        }

        .room-name {
          color: #2c3e50;
        }

        .room-number {
          color: #7f8c8d;
          font-size: 10px;
          font-weight: 400;
        }

        .day-cell {
          background: white;
          min-height: 80px;
          padding: 4px;
          position: relative;
          cursor: pointer;
        }

        .day-cell:hover {
          background: #f8f9fa;
        }

        .day-cell.weekend-cell {
          background: #fff5f5;
        }

        .day-cell.weekend-cell:hover {
          background: #ffeded;
        }

        .event-dot {
          width: 100%;
          height: 16px;
          border-radius: 3px;
          margin-bottom: 2px;
          font-size: 9px;
          padding: 2px 4px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .event-main {
          background: #d4edda;
          color: #155724;
          border-left: 3px solid #28a745;
        }

        .event-setup {
          background: #fff3cd;
          color: #856404;
          border-left: 3px solid #ffc107;
        }

        .event-conflict {
          background: #f8d7da;
          color: #721c24;
          border-left: 3px solid #dc3545;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .day-count {
          position: absolute;
          top: 2px;
          right: 4px;
          background: #007bff;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 700;
        }

        .day-count.conflict-count {
          background: #dc3545;
        }

        @media (max-width: 768px) {
          .calendar-grid {
            grid-template-columns: 100px repeat(14, 80px);
          }

          .room-name {
            font-size: 11px;
          }

          .event-dot {
            font-size: 8px;
            height: 12px;
          }
        }
      `}</style>

      <div className="calendar-grid">
        {/* Header Row */}
        <div className="room-label-header">Room</div>
        {days.map((day) => (
          <div
            key={day.fullDate.toISOString()}
            className={`date-header ${day.isWeekend ? "weekend-header" : ""}`}
          >
            <span className="date-num">{day.dateNum}</span>
            <span className="date-day">{day.dayName}</span>
          </div>
        ))}

        {/* Room Rows */}
        {building.rooms.map((room) => (
          <React.Fragment key={room.room_id}>
            {/* Room Label Cell */}
            <div className="room-label-cell">
              <span className="room-name">{room.room_name || `Room ${room.room_number}`}</span>
              {room.room_number && <span className="room-number">#{room.room_number}</span>}
            </div>

            {/* Day Cells */}
            {days.map((day) => {
              const eventsOnDay = (room.events || []).filter((event) => {
                const eventDate = new Date(event.start_time);
                return eventDate.toDateString() === day.fullDate.toDateString();
              });

              const conflictsOnDay = (room.conflicts || []).filter((conflict) => {
                const conflictDate = new Date(conflict.event1?.start_time || conflict.conflict_start_time);
                return conflictDate.toDateString() === day.fullDate.toDateString();
              });

              return (
                <div
                  key={`${room.room_id}-${day.fullDate.toISOString()}`}
                  className={`day-cell ${day.isWeekend ? "weekend-cell" : ""}`}
                >
                  {/* Conflict Indicators */}
                  {conflictsOnDay.length > 0 && (
                    <div className="event-dot event-conflict">
                      ⚠️ {conflictsOnDay.length}
                    </div>
                  )}

                  {/* Events */}
                  {eventsOnDay.slice(0, 2).map((event, idx) => (
                    <div
                      key={`${room.room_id}-${event.event_id}-${idx}`}
                      className="event-dot event-main"
                      title={event.event_name}
                    >
                      {event.event_name?.substring(0, 15) || "Event"}
                    </div>
                  ))}

                  {/* Count Badge */}
                  {eventsOnDay.length > 2 && (
                    <div className="day-count">+{eventsOnDay.length - 2}</div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}