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
  MessageSquare,
  Building2,
  Mail,
  Link as LinkIcon,
  ChevronDown,
  Circle,
  ArrowUpCircle,
  AlertCircle,
  Loader2,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TaskDetailModal({ task, open, onOpenChange, onTaskUpdated }) {
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
    if (!field.value && field.value !== 0) return null;
    
    switch (field.type) {
      case 'drop_down':
        return field.value;
      case 'labels':
        if (Array.isArray(field.value)) {
          return field.value.join(', ');
        }
        return field.value;
      case 'checkbox':
        return field.value ? '✓ Yes' : null;
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
      case 'phone':
        return field.value;
      case 'currency':
        return `$${field.value}`;
      case 'number':
        return field.value;
      case 'text':
      case 'short_text':
        return field.value;
      default:
        return field.value;
    }
  };

  const getCustomFieldIcon = (fieldName) => {
    const nameLower = fieldName.toLowerCase();
    if (nameLower.includes('building')) return Building2;
    if (nameLower.includes('email') || nameLower.includes('requestor')) return Mail;
    if (nameLower.includes('url') || nameLower.includes('website') || nameLower.includes('link')) return LinkIcon;
    if (nameLower.includes('date')) return Calendar;
    if (nameLower.includes('code')) return FileText;
    return FileText;
  };

  const customFieldsWithValues = task.custom_fields?.filter(field => {
    const value = formatCustomFieldValue(field);
    return value !== null && value !== '';
  }) || [];

  const importantFields = customFieldsWithValues.filter(field => 
    field.name.toLowerCase().includes('building') || 
    field.name.toLowerCase().includes('requestor') ||
    field.name.toLowerCase().includes('code')
  );
  
  const otherFields = customFieldsWithValues.filter(field => 
    !field.name.toLowerCase().includes('building') && 
    !field.name.toLowerCase().includes('requestor') &&
    !field.name.toLowerCase().includes('code')
  );

  const statusIcons = {
    'to do': Circle,
    'in progress': ArrowUpCircle,
    'ready': CheckCircle,
    'awaiting feedback': AlertCircle,
    'closed': CheckSquare
  };

  const getStatusIconComponent = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('to do')) return Circle;
    if (statusLower?.includes('in progress')) return ArrowUpCircle;
    if (statusLower?.includes('ready') || statusLower?.includes('done') || statusLower?.includes('complete')) return CheckCircle;
    if (statusLower?.includes('awaiting') || statusLower?.includes('pending') || statusLower?.includes('review')) return AlertCircle;
    return Circle;
  };

  const StatusIcon = getStatusIconComponent(task.status);

  const updateStatusMutation = useMutation({
    mutationFn: ({ task_id, status }) => 
      base44.functions.invoke('updateClickUpTask', { task_id, status }),
    onSuccess: () => {
      toast.success('Status updated!');
      if (onTaskUpdated) onTaskUpdated();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Update status error:', error);
      toast.error('Failed to update status');
    }
  });

  const closeTaskMutation = useMutation({
    mutationFn: ({ task_id, closed }) => 
      base44.functions.invoke('updateClickUpTask', { task_id, closed }),
    onSuccess: () => {
      toast.success('Task closed!');
      if (onTaskUpdated) onTaskUpdated();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Close task error:', error);
      toast.error('Failed to close task');
    }
  });

  const handleStatusChange = (newStatus) => {
    updateStatusMutation.mutate({ task_id: task.id, status: newStatus });
  };

  const handleCloseTask = () => {
    closeTaskMutation.mutate({ task_id: task.id, closed: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl pr-8">
              {task.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(task.url, '_blank')}
              className="flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Priority Section */}
          <div className="flex items-center gap-3 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <StatusIcon className="w-4 h-4" />
                  {formatStatus(task.status)}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleStatusChange('to do')}>
                  <Circle className="w-4 h-4 mr-2 text-gray-400" />
                  To Do
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('in progress')}>
                  <ArrowUpCircle className="w-4 h-4 mr-2 text-blue-500" />
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('ready')}>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Ready
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('awaiting feedback')}>
                  <AlertCircle className="w-4 h-4 mr-2 text-pink-500" />
                  Awaiting Feedback
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge className={getPriorityColor(task.priority) + " flex items-center gap-1"}>
              <Flag className="w-3 h-3" />
              {task.priority === 'none' ? 'No Priority' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Badge>

            {task.time_estimate && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeEstimate(task.time_estimate)}
              </Badge>
            )}

            {task.due_date && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(task.due_date), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>

          {/* Important Custom Fields */}
          {importantFields.length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3">
                {importantFields.map((field, idx) => {
                  const Icon = getCustomFieldIcon(field.name);
                  const value = formatCustomFieldValue(field);
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-0.5">{field.name}</div>
                        <div className="text-sm text-blue-800 font-medium">
                          {field.type === 'url' ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {value}
                            </a>
                          ) : field.type === 'email' ? (
                            <a href={`mailto:${value}`} className="hover:underline">
                              {value}
                            </a>
                          ) : (
                            value
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Details Grid */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Other Custom Fields */}
          {otherFields.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Additional Details</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {otherFields.map((field, idx) => {
                  const value = formatCustomFieldValue(field);
                  return (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 font-medium mb-1">{field.name}</div>
                      <div className="text-sm text-slate-900">
                        {field.type === 'url' ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {value}
                          </a>
                        ) : field.type === 'email' ? (
                          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
                            {value}
                          </a>
                        ) : (
                          value
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && task.description.trim() && (
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

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleCloseTask}
              disabled={closeTaskMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {closeTaskMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Close Task
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(task.url, '_blank')}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in ClickUp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}