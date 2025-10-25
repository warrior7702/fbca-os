import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Maximize2, List } from "lucide-react";
import { format, addDays, startOfWeek, isToday, startOfDay } from "date-fns";

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

  // Generate consistent colors for each list
  const getListColor = (listName) => {
    if (!listName) return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', ring: 'ring-slate-200' };
    
    let hash = 0;
    for (let i = 0; i < listName.length; i++) {
      hash = listName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', ring: 'ring-blue-200', dot: 'bg-blue-500' },
      { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', ring: 'ring-purple-200', dot: 'bg-purple-500' },
      { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', ring: 'ring-pink-200', dot: 'bg-pink-500' },
      { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', ring: 'ring-green-200', dot: 'bg-green-500' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', ring: 'ring-yellow-200', dot: 'bg-yellow-500' },
      { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', ring: 'ring-orange-200', dot: 'bg-orange-500' },
      { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', ring: 'ring-red-200', dot: 'bg-red-500' },
      { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', ring: 'ring-teal-200', dot: 'bg-teal-500' },
      { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
      { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', ring: 'ring-cyan-200', dot: 'bg-cyan-500' },
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

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'normal': return '🔵';
      case 'low': return '⚪';
      default: return '⚫';
    }
  };

  const week1 = twoWeeksDays.slice(0, 7);
  const week2 = twoWeeksDays.slice(7, 14);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeeks} className="h-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="default" size="sm" onClick={goToToday} className="h-8 bg-blue-600 hover:bg-blue-700">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeeks} className="h-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFullView} className="h-8">
          <Maximize2 className="w-4 h-4 mr-2" />
          Full View
        </Button>
      </div>

      {/* List Legend */}
      {listLegend.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 rounded-lg border border-slate-200">
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

      {/* Week 1 */}
      <div className="grid grid-cols-7 gap-3">
        {week1.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isTodayDate = isToday(day);

          return (
            <Card key={dateKey} className={`overflow-hidden transition-all hover:shadow-md ${isTodayDate ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
              <CardContent className="p-0">
                {/* Date Header */}
                <div className={`p-3 text-center border-b ${isTodayDate ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{format(day, 'EEE')}</div>
                  <div className={`text-2xl font-bold ${isTodayDate ? 'text-blue-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                {/* Tasks */}
                <div className="p-2 space-y-1.5 min-h-[120px]">
                  {dayTasks.slice(0, 3).map((task) => {
                    const listColor = getListColor(task.list_name);
                    const statusColor = getStatusColor(task.status);
                    return (
                      <a
                        key={task.id}
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className={`text-xs p-2 rounded-md ${listColor.bg} border ${listColor.border} hover:shadow-md transition-all cursor-pointer group`}>
                          <div className="flex items-start gap-1.5 mb-1">
                            <div className={`w-2 h-2 rounded-full ${statusColor} mt-0.5 flex-shrink-0`} title={task.status} />
                            <span className={`flex-1 font-medium leading-tight ${listColor.text} group-hover:underline`}>
                              {task.title}
                            </span>
                          </div>
                          {task.list_name && (
                            <div className="text-[10px] text-slate-600 truncate ml-3.5">
                              {task.list_name}
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 text-center font-medium pt-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                  {dayTasks.length === 0 && (
                    <div className="text-xs text-slate-300 text-center py-8">
                      No tasks
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Week 2 */}
      <div className="grid grid-cols-7 gap-3">
        {week2.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isTodayDate = isToday(day);

          return (
            <Card key={dateKey} className={`overflow-hidden transition-all hover:shadow-md ${isTodayDate ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
              <CardContent className="p-0">
                {/* Date Header */}
                <div className={`p-3 text-center border-b ${isTodayDate ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{format(day, 'EEE')}</div>
                  <div className={`text-2xl font-bold ${isTodayDate ? 'text-blue-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                {/* Tasks */}
                <div className="p-2 space-y-1.5 min-h-[120px]">
                  {dayTasks.slice(0, 3).map((task) => {
                    const listColor = getListColor(task.list_name);
                    const statusColor = getStatusColor(task.status);
                    return (
                      <a
                        key={task.id}
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className={`text-xs p-2 rounded-md ${listColor.bg} border ${listColor.border} hover:shadow-md transition-all cursor-pointer group`}>
                          <div className="flex items-start gap-1.5 mb-1">
                            <div className={`w-2 h-2 rounded-full ${statusColor} mt-0.5 flex-shrink-0`} title={task.status} />
                            <span className={`flex-1 font-medium leading-tight ${listColor.text} group-hover:underline`}>
                              {task.title}
                            </span>
                          </div>
                          {task.list_name && (
                            <div className="text-[10px] text-slate-600 truncate ml-3.5">
                              {task.list_name}
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 text-center font-medium pt-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                  {dayTasks.length === 0 && (
                    <div className="text-xs text-slate-300 text-center py-8">
                      No tasks
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