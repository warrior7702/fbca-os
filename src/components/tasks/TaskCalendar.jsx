
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Maximize2, Calendar, CheckCircle, Circle, XCircle, Hourglass, AlertCircle } from "lucide-react";
import { format, addDays, startOfWeek, isToday, startOfDay, isSameDay } from "date-fns";
import { motion } from "framer-motion"; // Import motion from framer-motion

export default function TaskCalendar({ tasks, onTaskClick, onViewFullCalendar }) {
  const [startDate, setStartDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const endDate = useMemo(() => addDays(startDate, 6), [startDate]);

  // Generate consistent colors for each list
  const getListColor = (listName) => {
    if (!listName) return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', ring: 'ring-slate-200', dot: 'bg-slate-500' };
    
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

  // Get ClickUp status icon based on text
  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('ready') || statusLower.includes('to do')) return CheckCircle;
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return Hourglass;
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev')) return Circle; 
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return CheckCircle; 
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return XCircle;
    if (statusLower.includes('review') || statusLower.includes('qa')) return AlertCircle; 
    return Circle; // Default icon
  };

  // Pre-aggregate tasks by date for efficient lookup
  const tasksByDate = useMemo(() => {
    const groupedTasks = {};
    tasks.forEach((task) => {
      if (task.due_date) {
        const dateKey = format(startOfDay(new Date(task.due_date)), 'yyyy-MM-dd');
        if (!groupedTasks[dateKey]) {
          groupedTasks[dateKey] = [];
        }
        groupedTasks[dateKey].push(task);
      }
    });
    return groupedTasks;
  }, [tasks]);

  const getDayTasks = (day) => {
    const dateKey = format(startOfDay(day), 'yyyy-MM-dd');
    return tasksByDate[dateKey] || [];
  };

  const changeWeek = (offset) => {
    setStartDate(prev => addDays(prev, offset * 7));
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="w-5 h-5 text-gray-700" />
            Task Calendar
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Current week view of upcoming tasks
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeWeek(-1)}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2 text-gray-700">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeWeek(1)}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewFullCalendar}
            className="ml-4 h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Maximize2 className="w-4 h-4 mr-1.5" />
            Full Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-3">
          {days.map((day, index) => {
            const dayTasks = getDayTasks(day);
            const today = new Date();
            const isTodayDate = isSameDay(day, today);
            
            return (
              <div
                key={index}
                className={`min-h-[160px] rounded-lg border-2 p-3 flex flex-col transition-all duration-200 ease-in-out hover:shadow-md ${
                  isTodayDate 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className={`text-sm font-semibold mb-2 ${
                  isTodayDate ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  {format(day, 'EEE d')}
                </div>
                
                <div className="space-y-1 flex-grow overflow-hidden">
                  {dayTasks.slice(0, 3).map((task) => {
                    const listColor = getListColor(task.list_name);
                    const StatusIcon = getStatusIcon(task.status);
                    
                    return (
                      <motion.button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        whileHover={{ scale: 1.02, backgroundColor: listColor.bg }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 rounded-md"
                      >
                        <div
                          className={`text-xs p-2 rounded-md ${listColor.bg} border ${listColor.border} flex items-center gap-1.5 group`}
                        >
                          <StatusIcon className={`w-3 h-3 flex-shrink-0 ${listColor.dot.replace('bg-', 'text-')}`} />
                          <span className={`truncate flex-1 font-medium ${listColor.text} group-hover:underline`}>{task.title}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                  
                  {dayTasks.length === 0 && (
                    <div className="text-xs text-slate-300 text-center py-4">
                      No tasks
                    </div>
                  )}
                </div>
                {dayTasks.length > 3 && (
                    <button
                      onClick={onViewFullCalendar} // Link to full calendar to see more tasks for the day
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 self-start"
                    >
                      +{dayTasks.length - 3} more
                    </button>
                  )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
