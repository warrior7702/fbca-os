import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Calendar,
  Flag,
  Folder,
  Layers,
  FileText,
  Clock,
  Tag,
  Users,
  CheckSquare,
  Paperclip,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";

export default function TaskDetailModal({ task, open, onOpenChange }) {
  if (!task) return null;

  const getPriorityColor = (priority) => {
    const colors = {
      'urgent': 'bg-red-500 text-white border-red-600',
      'high': 'bg-orange-400 text-white border-orange-500',
      'normal': 'bg-blue-400 text-white border-blue-500',
      'low': 'bg-gray-300 text-gray-800 border-gray-400',
      'none': 'bg-slate-300 text-slate-800 border-slate-400'
    };
    return colors[priority] || colors['none'];
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('ready') || statusLower.includes('to do')) return 'bg-green-500 text-white border-green-600';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500 text-white border-pink-600';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500 text-white border-blue-600';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev')) return 'bg-purple-500 text-white border-purple-600';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'bg-gray-500 text-white border-gray-600';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500 text-white border-red-600';
    if (statusLower.includes('review') || statusLower.includes('qa')) return 'bg-orange-500 text-white border-orange-600';
    
    return 'bg-slate-400 text-white border-slate-500';
  };

  const formatStatus = (status) => {
    if (!status) return 'No Status';
    return status
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatTimeEstimate = (ms) => {
    if (!ms) return null;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatCustomFieldValue = (field) => {
    if (!field.value) return 'Empty';
    
    switch (field.type) {
      case 'drop_down':
      case 'labels':
        return field.value;
      case 'checkbox':
        return field.value ? '✓ Yes' : '✗ No';
      case 'date':
        try {
          return format(new Date(parseInt(field.value)), 'MMM d, yyyy h:mm a');
        } catch {
          return field.value;
        }
      case 'url':
        return field.value;
      case 'email':
        return field.value;
      default:
        return field.value;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold pr-8">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(task.status)}>
              {formatStatus(task.status)}
            </Badge>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority === 'none' ? 'No Priority' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Badge>
            {task.time_estimate && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeEstimate(task.time_estimate)}
              </Badge>
            )}
          </div>

          {/* Main Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {task.due_date && (
              <div className="flex items-start gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Due Date</div>
                  <div className="text-slate-900">
                    {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              </div>
            )}

            {task.list_name && (
              <div className="flex items-start gap-2 text-sm">
                <Layers className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">List</div>
                  <div className="text-slate-900">{task.list_name}</div>
                </div>
              </div>
            )}

            {task.folder_name && (
              <div className="flex items-start gap-2 text-sm">
                <Folder className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Folder</div>
                  <div className="text-slate-900">{task.folder_name}</div>
                </div>
              </div>
            )}

            {task.space_name && (
              <div className="flex items-start gap-2 text-sm">
                <Folder className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Space</div>
                  <div className="text-slate-900">{task.space_name}</div>
                </div>
              </div>
            )}

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Users className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Assignees</div>
                  <div className="text-slate-900">{task.assignees.join(', ')}</div>
                </div>
              </div>
            )}

            {task.subtasks > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <CheckSquare className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Subtasks</div>
                  <div className="text-slate-900">{task.subtasks}</div>
                </div>
              </div>
            )}

            {task.attachments > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Paperclip className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Attachments</div>
                  <div className="text-slate-900">{task.attachments}</div>
                </div>
              </div>
            )}

            {task.comments > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 font-medium">Comments</div>
                  <div className="text-slate-900">{task.comments}</div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {task.custom_fields && task.custom_fields.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Custom Fields</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {task.custom_fields.map((field, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 font-medium mb-1">{field.name}</div>
                    <div className="text-sm text-slate-900">
                      {formatCustomFieldValue(field)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Description</span>
              </div>
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {task.description}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => window.open(task.url, '_blank')}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Full Task in ClickUp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}