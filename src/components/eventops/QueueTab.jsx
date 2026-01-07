import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { 
  ArrowUpDown, 
  PlayCircle, 
  CheckCircle2, 
  Clock,
  AlertCircle 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function QueueTab({ tasks, onTaskUpdate, onTaskClick }) {
  const [sortField, setSortField] = useState('due_at');
  const [sortDirection, setSortDirection] = useState('asc');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let aVal, bVal;
    
    if (sortField === 'due_at') {
      aVal = new Date(a.due_at).getTime();
      bVal = new Date(b.due_at).getTime();
    } else if (sortField === 'priority') {
      const priorityOrder = { critical: 4, high: 3, med: 2, low: 1 };
      aVal = priorityOrder[a.priority] || 0;
      bVal = priorityOrder[b.priority] || 0;
    } else if (sortField === 'status') {
      const statusOrder = { blocked: 4, in_progress: 3, todo: 2, done: 1 };
      aVal = statusOrder[a.status] || 0;
      bVal = statusOrder[b.status] || 0;
    } else if (sortField === 'room') {
      aVal = a.room_name || '';
      bVal = b.room_name || '';
    }
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleStatusChange = async (task, newStatus) => {
    setUpdatingTaskId(task.id);
    try {
      const updates = {
        status: newStatus,
        ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
      };
      
      await base44.entities.Ops_Task.update(task.id, updates);
      onTaskUpdate();
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      med: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300'
    };
    return colors[priority] || colors.med;
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'bg-slate-100 text-slate-700',
      in_progress: 'bg-blue-100 text-blue-700',
      blocked: 'bg-red-100 text-red-700',
      done: 'bg-green-100 text-green-700'
    };
    return colors[status] || colors.todo;
  };

  const SortHeader = ({ field, label }) => (
    <th 
      className="text-left p-3 cursor-pointer hover:bg-slate-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 uppercase">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </th>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <SortHeader field="due_at" label="Due At" />
                <th className="text-left p-3">
                  <div className="text-xs font-semibold text-slate-600 uppercase">Title</div>
                </th>
                <SortHeader field="priority" label="Priority" />
                <SortHeader field="status" label="Status" />
                <SortHeader field="room" label="Room" />
                <th className="text-left p-3">
                  <div className="text-xs font-semibold text-slate-600 uppercase">Actions</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map(task => (
                <tr 
                  key={task.id} 
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onTaskClick(task)}
                >
                  <td className="p-3">
                    <div className="text-sm text-slate-900">
                      {format(new Date(task.due_at), 'MMM d, h:mm a')}
                    </div>
                    {task.start_window_at && (
                      <div className="text-xs text-slate-500">
                        Window: {format(new Date(task.start_window_at), 'h:mm a')}
                      </div>
                    )}
                  </td>
                  
                  <td className="p-3">
                    <div>
                      <p className="font-medium text-sm text-slate-900">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {task.group}
                        </Badge>
                        {task.event_title && (
                          <span className="text-xs text-slate-500">{task.event_title}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </td>
                  
                  <td className="p-3">
                    <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  
                  <td className="p-3">
                    <span className="text-sm text-slate-600">{task.room_name || '-'}</span>
                  </td>
                  
                  <td className="p-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {task.status === 'todo' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(task, 'in_progress')}
                          disabled={updatingTaskId === task.id}
                          className="h-7 text-xs"
                        >
                          <PlayCircle className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(task, 'done')}
                          disabled={updatingTaskId === task.id}
                          className="h-7 text-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Done
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {sortedTasks.length === 0 && (
            <div className="p-12 text-center">
              <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No tasks in queue</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}