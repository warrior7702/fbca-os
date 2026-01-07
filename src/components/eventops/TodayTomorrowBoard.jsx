import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, PlayCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const TIME_BLOCKS = [
  { id: 'morning', label: 'Morning', start: 0, end: 12 },
  { id: 'afternoon', label: 'Afternoon', start: 12, end: 17 },
  { id: 'evening', label: 'Evening', start: 17, end: 24 }
];

const getTimeBlock = (dateTime) => {
  const hour = new Date(dateTime).getHours();
  return TIME_BLOCKS.find(block => hour >= block.start && hour < block.end)?.id || 'morning';
};

const StatusColumn = ({ status, tasks, onTaskClick }) => {
  const statusConfig = {
    todo: { label: 'To Do', icon: Clock, color: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'In Progress', icon: PlayCircle, color: 'bg-blue-100 text-blue-700' },
    blocked: { label: 'Blocked', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
    done: { label: 'Done', icon: CheckCircle2, color: 'bg-green-100 text-green-700' }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className={`p-2 rounded-lg ${config.color} flex items-center gap-2`}>
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm">{config.label}</span>
        <Badge variant="secondary" className="ml-auto">{tasks.length}</Badge>
      </div>
      
      <div className="space-y-2">
        {tasks.map(task => (
          <Card 
            key={task.id} 
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => onTaskClick(task)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm text-slate-900">{task.title}</p>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {task.group}
                </Badge>
              </div>
              
              {task.event_title && (
                <p className="text-xs text-slate-600 mb-1">{task.event_title}</p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{format(new Date(task.due_at), 'h:mm a')}</span>
                {task.room_name && (
                  <>
                    <span>•</span>
                    <span>{task.room_name}</span>
                  </>
                )}
              </div>
              
              {task.checklist && task.checklist.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {task.checklist.filter(item => item.done).length}/{task.checklist.length} complete
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default function TodayTomorrowBoard({ tasks, onTaskClick }) {
  const now = new Date();
  const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const upcomingTasks = tasks.filter(task => {
    const dueAt = new Date(task.due_at);
    return dueAt >= now && dueAt <= fortyEightHoursLater;
  });

  // Group by time block
  const tasksByBlock = TIME_BLOCKS.map(block => ({
    ...block,
    tasks: upcomingTasks.filter(task => getTimeBlock(task.due_at) === block.id)
  }));

  return (
    <div className="space-y-6">
      {tasksByBlock.map(block => {
        if (block.tasks.length === 0) return null;
        
        const tasksByStatus = {
          todo: block.tasks.filter(t => t.status === 'todo'),
          in_progress: block.tasks.filter(t => t.status === 'in_progress'),
          blocked: block.tasks.filter(t => t.status === 'blocked'),
          done: block.tasks.filter(t => t.status === 'done')
        };

        return (
          <Card key={block.id} className="border-2">
            <CardContent className="p-4">
              <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-600" />
                {block.label}
                <Badge variant="secondary" className="ml-2">{block.tasks.length}</Badge>
              </h3>
              
              <div className="grid md:grid-cols-4 gap-4">
                <StatusColumn status="todo" tasks={tasksByStatus.todo} onTaskClick={onTaskClick} />
                <StatusColumn status="in_progress" tasks={tasksByStatus.in_progress} onTaskClick={onTaskClick} />
                <StatusColumn status="blocked" tasks={tasksByStatus.blocked} onTaskClick={onTaskClick} />
                <StatusColumn status="done" tasks={tasksByStatus.done} onTaskClick={onTaskClick} />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {upcomingTasks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Tasks in Next 48 Hours
            </h3>
            <p className="text-slate-600">
              All caught up! No event ops tasks are due soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}