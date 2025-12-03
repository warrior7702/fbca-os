import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Calendar, Users, Trash2, Save, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function DeptTaskDetailModal({ 
  task, 
  isOpen, 
  onClose, 
  onUpdate, 
  onDelete,
  workers = []
}) {
  const [editedTask, setEditedTask] = useState(task || {});
  const [isEditing, setIsEditing] = useState(false);

  // Reset editedTask when task changes
  React.useEffect(() => {
    if (task) {
      setEditedTask(task);
      setIsEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    onUpdate(editedTask);
    setIsEditing(false);
    toast.success('Task updated');
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
    toast.success('Task deleted');
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
            </div>
            Dept Task Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Title</label>
            {isEditing ? (
              <Input
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              />
            ) : (
              <p className="text-lg font-semibold text-slate-900">{task.title}</p>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Assigned To</label>
            {isEditing ? (
              <Select 
                value={editedTask.assignee} 
                onValueChange={(v) => {
                  const worker = workers.find(w => w.user_email === v);
                  setEditedTask({ 
                    ...editedTask, 
                    assignee: v,
                    assigneeName: worker?.user_name || v
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={worker.user_email} value={worker.user_email}>
                      {worker.user_name || worker.user_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                  {getInitials(task.assigneeName)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{task.assigneeName}</p>
                  <p className="text-xs text-slate-500">{task.assignee}</p>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Details</label>
            {isEditing ? (
              <Textarea
                value={editedTask.details || ''}
                onChange={(e) => setEditedTask({ ...editedTask, details: e.target.value })}
                placeholder="What needs to be done..."
                rows={3}
              />
            ) : (
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-teal-600 mt-0.5" />
                <p className="text-slate-700">{task.details || <span className="text-slate-400 italic">No details provided</span>}</p>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Due Date</label>
            {isEditing ? (
              <Input
                type="date"
                value={editedTask.dueDate?.split('T')[0] || ''}
                onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value })}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span className="font-medium">{format(new Date(task.dueDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Status</label>
            <Badge className={task.completed ? 'bg-green-100 text-green-700' : 'bg-teal-100 text-teal-700'}>
              {task.completed ? 'Completed' : 'Active'}
            </Badge>
          </div>

          {/* Created Info */}
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500">
              Created by {task.createdBy} on {task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : 'Unknown'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  setEditedTask(task);
                  setIsEditing(false);
                }}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Task
                </Button>
                {!task.completed && (
                  <Button 
                    size="sm" 
                    onClick={() => {
                      onUpdate({ ...task, completed: true });
                      onClose();
                      toast.success('Task completed!');
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}