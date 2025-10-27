import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Grip } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from "date-fns";
import { toast } from "sonner";

export default function FullCalendarModal({ open, onOpenChange, tasks, onTaskClick, onTaskUpdate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState(null);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const firstDayOfMonth = start.getDay();
    
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - firstDayOfMonth);
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(calendarStart);
      day.setDate(calendarStart.getDate() + i);
      days.push(day);
    }
    
    return days;
  }, [currentMonth]);

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

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    
    if (!draggedTask) return;

    const newDueDate = format(day, 'yyyy-MM-dd') + 'T23:59:59.999Z';
    
    try {
      await onTaskUpdate(draggedTask.id, {
        due_date: newDueDate
      });
      toast.success('Task moved successfully');
    } catch (error) {
      console.error('Failed to move task:', error);
      toast.error('Failed to move task');
    } finally {
      setDraggedTask(null);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-red-500 border-red-600';
      case 'high': return 'bg-orange-400 border-orange-500';
      case 'normal': return 'bg-blue-400 border-blue-500';
      case 'low': return 'bg-gray-300 border-gray-400';
      default: return 'bg-slate-300 border-slate-400';
    }
  };

  const isCurrentMonth = (day) => {
    return day.getMonth() === currentMonth.getMonth();
  };

  const isToday = (day) => {
    const today = new Date();
    return day.toDateString() === today.toDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              {format(currentMonth, 'MMMM yyyy')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 gap-2 h-full">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-slate-700 py-3 border-b-2 border-slate-200">
                {day}
              </div>
            ))}

            {monthDays.map((day, index) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDay.get(dayKey) || [];
              const isCurrent = isToday(day);
              const inMonth = isCurrentMonth(day);

              return (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={`min-h-[120px] p-2 rounded-lg border-2 transition-all ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                      : inMonth
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className={`text-sm font-semibold mb-2 ${
                    isCurrent
                      ? 'text-indigo-600'
                      : inMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onClick={() => onTaskClick?.(task)}
                        className={`text-xs p-2 rounded border-l-4 cursor-move group transition-all ${
                          getPriorityColor(task.priority)
                        } text-white hover:shadow-lg hover:scale-105`}
                      >
                        <div className="flex items-start gap-1">
                          <Grip className="w-3 h-3 flex-shrink-0 opacity-50 group-hover:opacity-100" />
                          <span className="flex-1 line-clamp-2">{task.title}</span>
                        </div>
                        {task.list_name && (
                          <div className="text-[10px] opacity-75 mt-1 truncate">
                            {task.list_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}