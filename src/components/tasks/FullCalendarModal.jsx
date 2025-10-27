import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth, isToday } from "date-fns";
import { toast } from "sonner";

const LIST_COLORS = {
  'Special Event Master': '#22c55e',
  'Facilities Work Orders': '#0ea5e9',
  'Marketing': '#f59e0b',
  'IT & Technology': '#8b5cf6',
  'Worship & Production': '#ec4899',
  'Admin & Operations': '#6366f1',
  'default': '#94a3b8'
};

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

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('ready') || statusLower.includes('to do') || statusLower.includes('notstarted')) return 'bg-green-500 text-white border-green-600';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500 text-white border-pink-600';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500 text-white border-blue-600';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev') || statusLower.includes('inprogress')) return 'bg-purple-500 text-white border-purple-600';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'bg-gray-500 text-white border-gray-600';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500 text-white border-red-600';
    
    return 'bg-slate-400 text-white border-slate-500';
  };

  const formatStatus = (status) => {
    if (!status) return 'No Status';
    return status
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const isCurrentMonth = (day) => {
    return isSameMonth(day, currentMonth);
  };

  const isTodayDate = (day) => {
    return isToday(day);
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
              <div key={day} className="text-center text-xs font-bold text-slate-700 py-3 border-b-2 border-slate-200 uppercase tracking-wide">
                {day}
              </div>
            ))}

            {monthDays.map((day, index) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDay.get(dayKey) || [];
              const isCurrent = isTodayDate(day);
              const inMonth = isCurrentMonth(day);

              return (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={`min-h-[120px] p-2 rounded-xl border-2 transition-all ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-400 shadow-md'
                      : inMonth
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className={`text-sm font-bold mb-2 ${
                    isCurrent
                      ? 'text-blue-600'
                      : inMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayTasks.map((task) => {
                      const isMicrosoftToDo = task.source === 'microsoft_todo';
                      const listColor = isMicrosoftToDo ? '#0078d4' : (LIST_COLORS[task.list_name] || LIST_COLORS.default);
                      
                      return (
                        <div
                          key={task.id}
                          draggable={!isMicrosoftToDo}
                          onDragStart={(e) => !isMicrosoftToDo && handleDragStart(e, task)}
                          onClick={() => onTaskClick?.(task)}
                          className="text-xs p-2 rounded-lg border-l-4 bg-white hover:shadow-md cursor-pointer transition-all group"
                          style={{ borderLeftColor: listColor }}
                        >
                          <div className="flex items-start gap-1">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: listColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {task.title}
                              </div>
                              <Badge className={`${getStatusColor(task.status)} text-[10px] px-1 py-0 mt-1`}>
                                {formatStatus(task.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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