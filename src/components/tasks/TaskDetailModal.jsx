import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import { 
  ExternalLink, 
  Calendar as CalendarIcon, 
  Tag, 
  User,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const LIST_COLORS = {
  'Special Event Master': '#22c55e',
  'Facilities Work Orders': '#0ea5e9',
  'Marketing': '#f59e0b',
  'IT & Technology': '#8b5cf6',
  'Worship & Production': '#ec4899',
  'Admin & Operations': '#6366f1',
  'default': '#94a3b8'
};

export default function TaskDetailModal({ open, onOpenChange, task, onUpdate }) {
  const [dueDate, setDueDate] = useState(null);
  const [status, setStatus] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  useEffect(() => {
    if (task) {
      setDueDate(task.due_date ? parseISO(task.due_date) : null);
      setStatus(task.status || '');
      
      // Load available statuses for this list
      if (task.list_id && task.source !== 'microsoft_todo') {
        loadStatuses(task.list_id);
      }
    }
  }, [task]);

  const loadStatuses = async (listId) => {
    setLoadingStatuses(true);
    try {
      const response = await base44.functions.invoke('getClickUpListStatuses', {
        list_id: listId
      });
      setStatuses(response.data.statuses || []);
    } catch (error) {
      console.error('Failed to load statuses:', error);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const handleSave = async () => {
    if (!task) return;
    
    setLoading(true);
    try {
      // Update due date if changed
      if (dueDate && task.due_date !== dueDate.toISOString()) {
        await base44.functions.invoke('updateClickUpTaskDueDate', {
          task_id: task.id,
          due_date: dueDate.toISOString()
        });
      }

      // Update status if changed
      if (status && status !== task.status) {
        await base44.functions.invoke('updateClickUpTask', {
          task_id: task.id,
          status: status
        });
      }

      toast.success('Task updated successfully');
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!task) return;
    
    setLoading(true);
    try {
      await base44.functions.invoke('updateClickUpTask', {
        task_id: task.id,
        closed: true
      });
      
      toast.success('Task closed');
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to close task:', error);
      toast.error('Failed to close task');
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  const listColor = LIST_COLORS[task.list_name] || LIST_COLORS.default;
  const isMicrosoftToDo = task.source === 'microsoft_todo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: listColor }}
            />
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Details */}
          <div className="grid gap-4">
            {task.list_name && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">List:</span>
                <span className="text-sm font-medium">{task.list_name}</span>
              </div>
            )}

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Assigned to:</span>
                <span className="text-sm font-medium">{task.assignees.join(', ')}</span>
              </div>
            )}

            {/* Due Date Picker */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Due Date:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {dueDate ? format(dueDate, 'PPP') : 'Set due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Selector */}
            {!isMicrosoftToDo && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Status:</span>
                <Select value={status} onValueChange={setStatus} disabled={loadingStatuses}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Description:</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Tags:</span>
                {task.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between gap-2">
          <div className="flex gap-2">
            {task.url && (
              <Button
                variant="outline"
                onClick={() => window.open(task.url, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in {isMicrosoftToDo ? 'To Do' : 'ClickUp'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isMicrosoftToDo && (
              <Button
                variant="destructive"
                onClick={handleClose}
                disabled={loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Close Task
              </Button>
            )}
            <Button onClick={handleSave} disabled={loading || isMicrosoftToDo}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}