
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Added Badge import
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isToday } from "date-fns";

export default function FullCalendarModal({ open, onOpenChange, tasks }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const generateMonthDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const monthDays = generateMonthDays();

  const tasksByDate = {};
  tasks.forEach(task => {
    if (task.due_date) {
      const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = [];
      }
      tasksByDate[dateKey].push(task);
    }
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 border-red-600 text-white';
      case 'high': return 'bg-orange-400 border-orange-500 text-white';
      case 'normal': return 'bg-blue-400 border-blue-500 text-white';
      case 'low': return 'bg-gray-300 border-gray-400 text-gray-800';
      default: return 'bg-slate-300 border-slate-400 text-slate-800';
    }
  };

  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              {format(currentMonth, 'MMMM yyyy')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
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

        <div className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center font-semibold text-slate-700 border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Weeks */}
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((day, dayIdx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDate[dateKey] || [];
                  const isTodayDate = isToday(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={dayIdx}
                      className={`min-h-[120px] p-2 border-r last:border-r-0 ${
                        isTodayDate ? 'bg-indigo-50' : isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-semibold mb-2 ${
                        isTodayDate ? 'text-indigo-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      } flex items-center`}>
                        {format(day, 'd')}
                        {isTodayDate && (
                          <Badge className="ml-1 bg-indigo-600 text-[8px] px-1 py-0">Today</Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayTasks.map((task, taskIdx) => (
                          <a
                            key={taskIdx}
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <div className={`text-xs p-1.5 rounded border ${getPriorityColor(task.priority)} hover:opacity-90 transition-opacity cursor-pointer`}>
                              <div className="font-medium truncate">{task.title}</div>
                              {task.list_name && (
                                <div className="text-[10px] opacity-90 truncate mt-0.5">
                                  {task.list_name}
                                </div>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
