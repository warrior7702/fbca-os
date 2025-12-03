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
import { RepeatIcon, Calendar, Users, Trash2, Save, X, FileText, Folder, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { base44 } from "@/api/base44Client";

export default function RoutineTaskDetailModal({ 
  task, 
  isOpen, 
  onClose, 
  onUpdate, 
  onDelete,
  workers = []
}) {
  const [editedTask, setEditedTask] = useState(task || {});
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    toast.success('Routine task updated');
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
    toast.success('Routine task deleted');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditedTask({
        ...editedTask,
        attachments: [...(editedTask.attachments || []), { name: file.name, url: file_url }]
      });
      toast.success('File attached');
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx) => {
    setEditedTask({
      ...editedTask,
      attachments: editedTask.attachments.filter((_, i) => i !== idx)
    });
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
            <div className="p-2 bg-indigo-100 rounded-lg">
              <RepeatIcon className="w-5 h-5 text-indigo-600" />
            </div>
            Routine Task Details
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
                value={editedTask.assignee || ""} 
                onValueChange={(v) => {
                  const worker = workers.find(w => w.user_email === v);
                  setEditedTask({ 
                    ...editedTask, 
                    assignee: v,
                    assigneeName: worker?.user_name || v || 'Unassigned'
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.user_email} value={worker.user_email}>
                      {worker.user_name || worker.user_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold">
                  {getInitials(task.assigneeName)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{task.assigneeName || 'Unassigned'}</p>
                  <p className="text-xs text-slate-500">{task.assignee || 'No email'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Description</label>
            {isEditing ? (
              <Textarea
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                placeholder="Task description..."
                rows={3}
              />
            ) : (
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-indigo-600 mt-0.5" />
                <p className="text-slate-700">{task.description || <span className="text-slate-400 italic">No description provided</span>}</p>
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Frequency</label>
            {isEditing ? (
              <Select 
                value={editedTask.frequency} 
                onValueChange={(v) => setEditedTask({ ...editedTask, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300">
                {task.frequency?.charAt(0).toUpperCase() + task.frequency?.slice(1)}
              </Badge>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Next Due Date</label>
            {isEditing ? (
              <Input
                type="date"
                value={editedTask.nextDueDate?.split('T')[0] || editedTask.dueDate?.split('T')[0] || ''}
                onChange={(e) => setEditedTask({ ...editedTask, nextDueDate: e.target.value, dueDate: e.target.value })}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="font-medium">
                  {task.nextDueDate || task.dueDate 
                    ? format(new Date((task.nextDueDate || task.dueDate) + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
                    : 'No due date set'}
                </span>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Attachments</label>
            <div className="flex items-center gap-2 flex-wrap">
              {(isEditing ? editedTask.attachments : task.attachments || [])?.map((attachment, idx) => {
                // For SharePoint/OneDrive files, use web URL to open in browser viewer
                const getViewUrl = (url) => {
                  if (!url) return url;
                  // If it's already a sharepoint.com or onedrive URL, it should open in browser
                  if (url.includes('sharepoint.com') || url.includes('onedrive.com') || url.includes('1drv.ms')) {
                    // Convert download URLs to view URLs if needed
                    return url.replace('/download/', '/view/').replace('?download=1', '');
                  }
                  return url;
                };
                
                return (
                <div key={idx} className="flex items-center gap-1">
                  <a
                    href={getViewUrl(attachment.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100"
                  >
                    <Folder className="w-3 h-3" />
                    {attachment.name || `File ${idx + 1}`}
                  </a>
                  {isEditing && (
                    <button 
                      onClick={() => removeAttachment(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
              })}
              {isEditing && (
                <label className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-200 cursor-pointer">
                  <Plus className="w-3 h-3" />
                  {uploading ? 'Uploading...' : 'Add File'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              )}
              {(!task.attachments || task.attachments.length === 0) && !isEditing && (
                <span className="text-slate-400 text-sm italic">No attachments</span>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Status</label>
            <Badge className="bg-green-100 text-green-700">
              Active
            </Badge>
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
                <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Edit Task
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}