import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, isToday, parseISO, isBefore, startOfDay } from "date-fns";

const LIST_COLORS = {
  'Special Event Master': '#22c55e',
  'Facilities Work Orders': '#0ea5e9',
  'Marketing': '#f59e0b',
  'IT & Technology': '#8b5cf6',
  'Worship & Production': '#ec4899',
  'Admin & Operations': '#6366f1',
  'default': '#94a3b8'
};

export default function TaskCalendar({ tasks, onTaskClick, weekCount = 2 }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const days = useMemo(() => {
    const totalDays = weekCount * 7;
    return Array.from({ length: totalDays }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart, weekCount]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (task.due_date) {
        try {
          const dueDate = parseISO(task.due_date);
          const dayKey = format(dueDate, 'yyyy-MM-dd');
          if (!map.has(dayKey)) {
            map.set(dayKey, []);
          }
          map.get(dayKey).push(task);
        } catch (error) {
          console.error('Invalid task date:', task.due_date);
        }
      }
    });
    return map;
  }, [tasks]);

  const goToPrevious = () => {
    setCurrentWeekStart(prev => addDays(prev, -weekCount * 7));
  };

  const goToNext = () => {
    setCurrentWeekStart(prev => addDays(prev, weekCount * 7));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const getListColor = (listName) => {
    return LIST_COLORS[listName] || LIST_COLORS.default;
  };

  const isPastDue = (day) => {
    return isBefore(day, startOfDay(new Date())) && !isToday(day);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {format(days[0], 'MMM d')} - {format(days[days.length - 1], 'MMM d, yyyy')}
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-bold text-slate-700 py-2 uppercase tracking-wide">
            {day}
          </div>
        ))}

        {/* Day Cells */}
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(dayKey) || [];
          const isCurrentDay = isToday(day);
          const isPast = isPastDue(day);

          return (
            <div
              key={dayKey}
              className={`min-h-[110px] p-3 rounded-xl border-2 transition-all ${
                isCurrentDay
                  ? 'bg-blue-50 border-blue-400 shadow-md'
                  : isPast
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`text-sm font-bold mb-2 ${
                isCurrentDay
                  ? 'text-blue-600'
                  : isPast
                  ? 'text-slate-400'
                  : 'text-slate-700'
              }`}>
                {format(day, 'd')}
              </div>

              <div className="space-y-1.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const listColor = getListColor(task.list_name);
                  
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(task);
                      }}
                      className="group cursor-pointer"
                    >
                      <div 
                        className="text-xs p-2 rounded-lg border-l-4 bg-white shadow-sm hover:shadow-md transition-all truncate font-medium"
                        style={{ borderLeftColor: listColor }}
                      >
                        {task.title}
                      </div>
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-slate-500 font-medium pl-2">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}