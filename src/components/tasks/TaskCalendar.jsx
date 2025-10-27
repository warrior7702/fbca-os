import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Circle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, isToday, parseISO } from "date-fns";

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

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-400';
      case 'normal': return 'bg-blue-400';
      case 'low': return 'bg-gray-300';
      default: return 'bg-slate-300';
    }
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
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-slate-600 py-2">
            {day}
          </div>
        ))}

        {/* Day Cells */}
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(dayKey) || [];
          const isCurrentDay = isToday(day);

          return (
            <div
              key={dayKey}
              className={`min-h-[100px] p-2 rounded-lg border transition-all ${
                isCurrentDay
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold mb-2 ${
                isCurrentDay ? 'text-indigo-600' : 'text-slate-700'
              }`}>
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick?.(task);
                    }}
                    className="group cursor-pointer"
                  >
                    <div className={`text-xs p-1.5 rounded truncate transition-all ${
                      getPriorityColor(task.priority)
                    } text-white group-hover:shadow-md`}>
                      {task.title}
                    </div>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-slate-500 pl-1.5">
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