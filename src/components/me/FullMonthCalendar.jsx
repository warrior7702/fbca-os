import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isToday, isSameDay } from "date-fns";

export default function FullMonthCalendar({ open, onOpenChange, tasks }) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

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
    if (task.due_at) {
      const dateKey = format(new Date(task.due_at), 'yyyy-MM-dd');
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = [];
      }
      tasksByDate[dateKey].push(task);
    }
  });

  const getTaskStatusColor = (status) => {
    const colors = {
      'Todo': 'bg-gray-100 text-gray-800',
      'In_Progress': 'bg-blue-100 text-blue-800',
      'Blocked': 'bg-red-100 text-red-800',
      'Done': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center font-semibold text-gray-700 border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

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
                      }`}>
                        {format(day, 'd')}
                        {isTodayDate && (
                          <Badge className="ml-1 bg-indigo-600 text-[8px] px-1 py-0">Today</Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map((task, taskIdx) => (
                          <div
                            key={taskIdx}
                            className="text-xs p-1.5 rounded bg-white border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer"
                          >
                            <Badge className={`${getTaskStatusColor(task.status)} text-[8px] px-1 py-0 mb-1`}>
                              {task.status}
                            </Badge>
                            <div className="font-medium text-gray-900 line-clamp-2">
                              {task.title}
                            </div>
                            {task.due_at && (
                              <div className="text-[10px] text-gray-500 mt-1">
                                {format(new Date(task.due_at), 'h:mm a')}
                              </div>
                            )}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
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