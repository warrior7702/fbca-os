
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isToday } from "date-fns";

export default function FullCalendarModal({ open, onOpenChange, tasks, onTaskClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate consistent colors for each list
  const getListColor = (listName) => {
    if (!listName) return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' };
    
    let hash = 0;
    for (let i = 0; i < listName.length; i++) {
      hash = listName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500' },
      { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400', dot: 'bg-purple-500' },
      { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-400', dot: 'bg-pink-500' },
      { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-400', dot: 'bg-green-500' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400', dot: 'bg-yellow-500' },
      { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400', dot: 'bg-orange-500' },
      { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', dot: 'bg-red-500' },
      { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-400', dot: 'bg-teal-500' },
      { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-400', dot: 'bg-indigo-500' },
      { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-400', dot: 'bg-cyan-500' },
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get ClickUp status color
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    // Match ClickUp's status colors
    if (statusLower.includes('ready') || statusLower.includes('to do')) return 'bg-green-500';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev')) return 'bg-purple-500';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'bg-gray-400';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500';
    if (statusLower.includes('review') || statusLower.includes('qa')) return 'bg-orange-500';
    
    return 'bg-slate-400'; // Default
  };

  // Get unique lists and their colors
  const listLegend = useMemo(() => {
    const uniqueLists = [...new Set(tasks.map(t => t.list_name).filter(Boolean))];
    return uniqueLists.map(listName => ({
      name: listName,
      color: getListColor(listName)
    }));
  }, [tasks]);

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

  // This function is no longer used for the dot, but kept if needed elsewhere
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'normal': return '🔵';
      case 'low': return '⚪';
      default: return '⚫';
    }
  };

  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-3xl font-bold">
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
                variant="default"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="bg-blue-600 hover:bg-blue-700"
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

          {/* List Legend */}
          {listLegend.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 rounded-lg border border-slate-200 mt-3">
              <List className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-600 mr-1">Lists:</span>
              {listLegend.map((list) => (
                <Badge key={list.name} variant="outline" className={`${list.color.bg} ${list.color.text} ${list.color.border} text-xs`}>
                  <div className={`w-2 h-2 rounded-full ${list.color.dot} mr-1.5`} />
                  {list.name}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div key={day} className="p-3 text-center font-semibold text-slate-700 border-r last:border-r-0 text-sm">
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
                      className={`min-h-[140px] p-2 border-r last:border-r-0 ${
                        isTodayDate ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`text-base font-semibold mb-2 ${
                        isTodayDate ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      } flex items-center justify-between`}>
                        <span>{format(day, 'd')}</span>
                        {isTodayDate && (
                          <Badge className="bg-blue-600 text-[8px] px-1.5 py-0">Today</Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayTasks.map((task, taskIdx) => {
                          const listColor = getListColor(task.list_name);
                          const statusColor = getStatusColor(task.status);
                          return (
                            <div
                              key={taskIdx}
                              onClick={(e) => onTaskClick && onTaskClick(task, e)}
                              className="cursor-pointer"
                            >
                              <div className={`text-xs p-1.5 rounded-md border ${listColor.bg} ${listColor.border} hover:shadow-md transition-all group`}>
                                <div className="flex items-start gap-1 mb-0.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${statusColor} mt-0.5 flex-shrink-0`} title={task.status} />
                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium truncate ${listColor.text} group-hover:underline leading-tight`}>
                                      {task.title}
                                    </div>
                                    {task.list_name && (
                                      <div className="text-[9px] text-slate-600 truncate mt-0.5">
                                        {task.list_name}
                                      </div>
                                    )}
                                  </div>
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
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
