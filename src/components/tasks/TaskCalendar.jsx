import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isToday, startOfDay } from "date-fns";

export default function TaskCalendar({ tasks, onOpenFullView }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const generateTwoWeeks = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  };

  const twoWeeksDays = generateTwoWeeks();

  const tasksByDate = {};
  tasks.forEach((task) => {
    if (task.due_date) {
      const dateKey = format(startOfDay(new Date(task.due_date)), 'yyyy-MM-dd');
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = [];
      }
      tasksByDate[dateKey].push(task);
    }
  });

  const goToPreviousWeeks = () => {
    setCurrentWeekStart(prev => addDays(prev, -14));
  };

  const goToNextWeeks = () => {
    setCurrentWeekStart(prev => addDays(prev, 14));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const week1 = twoWeeksDays.slice(0, 7);
  const week2 = twoWeeksDays.slice(7, 14);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeeks}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeeks}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFullView}>
          <Maximize2 className="w-4 h-4 mr-2" />
          Full Calendar
        </Button>
      </div>

      {/* Week 1 */}
      <div className="grid grid-cols-7 gap-2">
        {week1.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isTodayDate = isToday(day);

          return (
            <Card key={dateKey} className={isTodayDate ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-3">
                <div className="text-center mb-2">
                  <div className="text-xs text-slate-500">{format(day, 'EEE')}</div>
                  <div className={`text-lg font-semibold ${isTodayDate ? 'text-blue-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <a
                      key={task.id}
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="text-xs p-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer">
                        <div className="flex items-center gap-1 mb-1">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          <span className="truncate flex-1">{task.title}</span>
                        </div>
                        {task.list_name && (
                          <div className="text-[10px] text-slate-500 truncate">
                            {task.list_name}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 text-center">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Week 2 */}
      <div className="grid grid-cols-7 gap-2">
        {week2.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isTodayDate = isToday(day);

          return (
            <Card key={dateKey} className={isTodayDate ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-3">
                <div className="text-center mb-2">
                  <div className="text-xs text-slate-500">{format(day, 'EEE')}</div>
                  <div className={`text-lg font-semibold ${isTodayDate ? 'text-blue-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <a
                      key={task.id}
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="text-xs p-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer">
                        <div className="flex items-center gap-1 mb-1">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          <span className="truncate flex-1">{task.title}</span>
                        </div>
                        {task.list_name && (
                          <div className="text-[10px] text-slate-500 truncate">
                            {task.list_name}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 text-center">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}