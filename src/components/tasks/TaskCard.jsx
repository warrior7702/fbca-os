import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const LIST_COLORS = {
  'Special Event Master': '#22c55e',
  'Facilities Work Orders': '#0ea5e9',
  'Marketing': '#f59e0b',
  'IT & Technology': '#8b5cf6',
  'Worship & Production': '#ec4899',
  'Admin & Operations': '#6366f1',
  'default': '#94a3b8'
};

export default function TaskCard({ task, onClick }) {
  const listColor = LIST_COLORS[task.list_name] || LIST_COLORS.default;
  
  const getPriorityBadge = (priority) => {
    const colors = {
      'urgent': 'bg-red-500 text-white',
      'high': 'bg-orange-400 text-white',
      'normal': 'bg-blue-400 text-white',
      'low': 'bg-gray-300 text-gray-800',
      'none': 'bg-slate-300 text-slate-800'
    };
    return colors[priority] || colors['none'];
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('ready') || statusLower.includes('to do') || statusLower.includes('notstarted')) return 'bg-green-500 text-white';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500 text-white';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500 text-white';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('inprogress')) return 'bg-purple-500 text-white';
    if (statusLower.includes('done') || statusLower.includes('complete')) return 'bg-gray-500 text-white';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500 text-white';
    if (statusLower.includes('review') || statusLower.includes('qa')) return 'bg-orange-500 text-white';
    
    return 'bg-slate-400 text-white';
  };

  const formatStatus = (status) => {
    if (!status) return 'No Status';
    
    return status
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const isMicrosoftToDo = task.source === 'microsoft_todo';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card 
        className="hover:shadow-lg transition-all cursor-pointer border-l-4"
        style={{ borderLeftColor: listColor }}
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: listColor }}
                />
                <h3 className="font-semibold text-slate-900">{task.title}</h3>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {task.priority && task.priority !== 'none' && (
                  <Badge className={getPriorityBadge(task.priority)}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </Badge>
                )}
                <Badge className={getStatusColor(task.status)}>
                  {formatStatus(task.status)}
                </Badge>
                {isMicrosoftToDo && (
                  <Badge variant="outline" className="text-xs">Microsoft To Do</Badge>
                )}
              </div>

              {task.list_name && (
                <p className="text-xs text-slate-500 mt-2 font-medium">{task.list_name}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}