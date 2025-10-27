import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  ArrowUpCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  X
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from "date-fns";
import { motion } from "framer-motion";
import TaskDetailModal from "./TaskDetailModal";

export default function FullCalendarModal({ open, onOpenChange, tasks, onTaskUpdated }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get all days including padding for week alignment
  const firstDayOfMonth = monthStart.getDay();
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const paddingDays = Array(firstDayOfMonth).fill(null);
  const allDays = [...paddingDays, ...daysInMonth];

  const getListColor = (listName) => {
    if (!listName) return 'bg-slate-100 text-slate-700';
    
    const colors = {
      'Marketing': 'bg-purple-100 text-purple-700 border-purple-300',
      'Facilities': 'bg-blue-100 text-blue-700 border-blue-300',
      'IT': 'bg-green-100 text-green-700 border-green-300',
      'Events': 'bg-pink-100 text-pink-700 border-pink-300',
      'Worship': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    };
    
    const matchedColor = Object.entries(colors).find(([key]) => 
      listName.toLowerCase().includes(key.toLowerCase())
    );
    
    return matchedColor ? matchedColor[1] : 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('done') || statusLower.includes('complete')) return CheckCircle;
    if (statusLower.includes('progress') || statusLower.includes('active')) return ArrowUpCircle;
    if (statusLower.includes('awaiting') || statusLower.includes('review')) return AlertCircle;
    if (statusLower.includes('ready') || statusLower.includes('to do')) return Circle;
    return Clock;
  };

  const getDayTasks = (day) => {
    if (!day) return [];
    return tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), day)
    );
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

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
    if (!draggedTask || !day) return;

    // Update the task's due date
    try {
      await base44.functions.invoke('updateClickUpTaskDueDate', {
        task_id: draggedTask.id,
        due_date: day.toISOString()
      });
      
      toast.success('Due date updated!');
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error('Failed to update due date:', error);
      toast.error('Failed to update due date');
    }
    
    setDraggedTask(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">Task Calendar</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-lg font-semibold px-4">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date())}
                  className="ml-2"
                >
                  Today
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-sm text-slate-600 p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {allDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="min-h-[100px]" />;
                }

                const dayTasks = getDayTasks(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <div
                    key={index}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day)}
                    className={`min-h-[100px] rounded-lg border-2 p-2 transition-all ${
                      isToday 
                        ? 'border-blue-500 bg-blue-50' 
                        : isCurrentMonth
                        ? 'border-slate-200 bg-white hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50'
                    } ${draggedTask ? 'hover:border-blue-400 hover:bg-blue-50' : ''}`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${
                      isToday 
                        ? 'text-blue-600' 
                        : isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-1">
                      {dayTasks.map((task) => {
                        const listColor = getListColor(task.list_name);
                        const StatusIcon = getStatusIcon(task.status);

                        return (
                          <motion.button
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task)}
                            onClick={() => handleTaskClick(task)}
                            whileHover={{ scale: 1.02 }}
                            className="w-full text-left cursor-move"
                          >
                            <div
                              className={`text-xs p-1.5 rounded border ${listColor} flex items-center gap-1 hover:shadow-sm transition-shadow`}
                            >
                              <StatusIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate flex-1">{task.title}</span>
                            </div>
                          </motion.button>
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={showTaskDetail}
          onOpenChange={setShowTaskDetail}
          onTaskUpdated={() => {
            if (onTaskUpdated) onTaskUpdated();
            setShowTaskDetail(false);
          }}
        />
      )}
    </>
  );
}