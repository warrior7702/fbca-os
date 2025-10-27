import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckSquare, 
  Calendar, 
  Mail, 
  ExternalLink, 
  AlertCircle,
  Flag,
  Loader2,
  Paperclip,
  Tag,
  Maximize2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState({ focused: [], categorized: {} });
  const [loading, setLoading] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadingEmails(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.clickup_access_token) {
        toast.error('Please connect ClickUp in Settings');
      }

      if (!currentUser.microsoft_access_token) {
        toast.error('Please connect Microsoft 365 in Settings');
      }

      if (currentUser.clickup_access_token) {
        try {
          const tasksResponse = await base44.functions.invoke('getMyClickUpTasks');
          setTasks(tasksResponse.data.tasks || []);
        } catch (error) {
          console.error('Error fetching tasks:', error);
          toast.error('Failed to load ClickUp tasks');
        }
      }

      if (currentUser.microsoft_access_token) {
        try {
          const emailsResponse = await base44.functions.invoke('getCategorizedEmails');
          console.log('Emails response:', emailsResponse.data);
          setEmails(emailsResponse.data);
        } catch (error) {
          console.error('Error fetching emails:', error);
          toast.error('Failed to load emails');
        } finally {
          setLoadingEmails(false);
        }
      } else {
        setLoadingEmails(false);
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    if (!task?.url) {
      toast.error('Task URL not available');
      return;
    }
    
    if (!/^https?:\/\//i.test(task.url)) {
      toast.error('Invalid task URL');
      return;
    }
    
    window.open(task.url, '_blank', 'noopener,noreferrer');
  };

  const todayTasks = tasks.filter(task => 
    task.due_date && isToday(new Date(task.due_date))
  );

  const getPriorityBadge = (priority) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.full_name;

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {(!user?.clickup_access_token || !user?.microsoft_access_token) && (
          <ConnectionWarning />
        )}
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-600">Welcome back, {displayName}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Today's Tasks
              </CardTitle>
              <Badge variant="secondary">{todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No tasks due today! 🎉</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="block p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 mb-1">{task.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getPriorityBadge(task.priority)}>
                            {task.priority === 'none' ? 'No Priority' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {formatStatus(task.status)}
                          </Badge>
                          {task.list_name && (
                            <span className="text-xs text-slate-500">{task.list_name}</span>
                          )}
                        </div>
                      </div>
                      {task.url && (
                        <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 hover:text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Task Calendar - Next 2 Weeks
              </CardTitle>
              <CardDescription>Your upcoming tasks at a glance</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFullCalendar(true)}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Full View
            </Button>
          </CardHeader>
          <CardContent>
            <TaskCalendar 
              tasks={tasks} 
              onTaskClick={handleTaskClick}
              weekCount={2}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Focused Inbox
            </CardTitle>
            <CardDescription>Important emails requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEmails ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              </div>
            ) : emails.focused && emails.focused.length > 0 ? (
              <div className="space-y-2">
                {emails.focused.slice(0, 5).map((email, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Mail className={`w-4 h-4 mt-1 flex-shrink-0 ${
                      email.isRead ? 'text-slate-400' : 'text-blue-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm truncate ${
                          email.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'
                        }`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        {email.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {email.fromName || email.from}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                      </p>
                      {email.categories && email.categories.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {email.categories.map((cat, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                No focused emails
              </p>
            )}
          </CardContent>
        </Card>

        {emails.categorized && Object.keys(emails.categorized).length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(emails.categorized).map(([category, categoryEmails]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {category}
                  </CardTitle>
                  <CardDescription>{categoryEmails.length} email{categoryEmails.length !== 1 ? 's' : ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {categoryEmails.slice(0, 10).map((email, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded hover:bg-slate-50 transition-colors"
                      >
                        <p className={`text-sm truncate ${
                          email.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'
                        }`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {email.fromName || email.from}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FullCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        tasks={tasks}
        onTaskClick={handleTaskClick}
        onTaskUpdate={async (taskId, updates) => {
          try {
            await base44.functions.invoke('updateClickUpTaskDueDate', {
              task_id: taskId,
              due_date: updates.due_date
            });
            toast.success('Task updated');
            loadData();
          } catch (error) {
            toast.error('Failed to update task');
            throw error;
          }
        }}
      />
    </div>
  );
}