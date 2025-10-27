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
  Loader2,
  Paperclip,
  Tag,
  Maximize2,
  ListChecks
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import TaskCard from "../components/tasks/TaskCard";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

const CATEGORY_COLORS = {
  'Action Needed': '#c43e00',
  'Followup': '#6f42c1',
  'Follow up': '#6f42c1',
  'Networking': '#d97706',
  'Pending Order': '#0d9488',
  'default': '#64748b'
};

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [clickupTasks, setClickupTasks] = useState([]);
  const [todoTasks, setTodoTasks] = useState([]);
  const [emails, setEmails] = useState({ focused: [], unread: [], categorized: {} });
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

      if (!currentUser.clickup_access_token && !currentUser.microsoft_access_token) {
        toast.error('Please connect ClickUp or Microsoft 365 in Settings');
      }

      // Load ClickUp tasks
      if (currentUser.clickup_access_token) {
        try {
          const tasksResponse = await base44.functions.invoke('getMyClickUpTasks');
          setClickupTasks(tasksResponse.data.tasks || []);
        } catch (error) {
          console.error('Error fetching ClickUp tasks:', error);
          toast.error('Failed to load ClickUp tasks');
        }
      }

      // Load Microsoft To Do tasks
      if (currentUser.microsoft_access_token) {
        try {
          const todoResponse = await base44.functions.invoke('getMicrosoftToDo');
          setTodoTasks(todoResponse.data.tasks || []);
        } catch (error) {
          console.error('Error fetching Microsoft To Do:', error);
          toast.error('Failed to load Microsoft To Do');
        }

        // Load emails
        try {
          const emailsResponse = await base44.functions.invoke('getCategorizedEmails');
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
    if (task.source === 'microsoft_todo') {
      if (task.url) {
        window.open(task.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

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

  // Combine all tasks
  const allTasks = [...clickupTasks, ...todoTasks];
  
  const todayTasks = allTasks.filter(task => 
    task.due_date && isToday(new Date(task.due_date))
  );

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('ready') || statusLower.includes('to do') || statusLower.includes('notstarted')) return 'bg-green-500 text-white border-green-600';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500 text-white border-pink-600';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500 text-white border-blue-600';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev') || statusLower.includes('inprogress')) return 'bg-purple-500 text-white border-purple-600';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'bg-gray-500 text-white border-gray-600';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500 text-white border-red-600';
    
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
        {(!user?.clickup_access_token && !user?.microsoft_access_token) && (
          <ConnectionWarning />
        )}

        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-600">Welcome back, {displayName}</p>
        </div>

        {/* Today's Tasks - NO PRIORITY BADGES */}
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
                    key={`${task.source}-${task.id}`}
                    onClick={() => handleTaskClick(task)}
                    className="block p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {task.source === 'microsoft_todo' ? (
                            <ListChecks className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          )}
                          <h3 className="font-medium text-slate-900">{task.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getStatusColor(task.status)}>
                            {formatStatus(task.status)}
                          </Badge>
                          {task.list_name && (
                            <span className="text-xs text-slate-500">{task.list_name}</span>
                          )}
                          {task.source === 'microsoft_todo' && (
                            <Badge variant="outline" className="text-xs">Microsoft To Do</Badge>
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

        {/* Task Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Task Calendar
              </CardTitle>
              <CardDescription>Your upcoming tasks</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFullCalendar(true)}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Full Calendar
            </Button>
          </CardHeader>
          <CardContent>
            <TaskCalendar 
              tasks={allTasks} 
              onTaskClick={handleTaskClick}
              weekCount={2}
            />
          </CardContent>
        </Card>

        {/* All Tasks Grid */}
        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>{allTasks.length} total tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTasks.map((task) => (
                <TaskCard 
                  key={`${task.source}-${task.id}`} 
                  task={task} 
                  onClick={() => handleTaskClick(task)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Email Sections */}
        {user?.microsoft_access_token && (
          <>
            {/* Highlighted / Focused Inbox */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Highlighted
                </CardTitle>
                <CardDescription>Focused Inbox - Important unread emails</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmails ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  </div>
                ) : emails.focused && emails.focused.length > 0 ? (
                  <div className="space-y-2">
                    {emails.focused.slice(0, 10).map((email, idx) => (
                      <a
                        key={idx}
                        href={email.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors block"
                      >
                        <Mail className="w-4 h-4 mt-1 flex-shrink-0 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
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
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No highlighted emails
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Unread Emails */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-600" />
                  Unread
                </CardTitle>
                <CardDescription>All unread inbox messages</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmails ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" />
                  </div>
                ) : emails.unread && emails.unread.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {emails.unread.slice(0, 20).map((email, idx) => (
                      <a
                        key={idx}
                        href={email.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors block"
                      >
                        <Mail className="w-4 h-4 mt-1 flex-shrink-0 text-amber-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
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
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No unread emails
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Categories */}
            {emails.categorized && Object.keys(emails.categorized).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Categories
                  </CardTitle>
                  <CardDescription>
                    {Object.keys(emails.categorized).length} categor{Object.keys(emails.categorized).length !== 1 ? 'ies' : 'y'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(emails.categorized).map(([category, categoryEmails]) => {
                      const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
                      
                      return (
                        <Card key={category} className="bg-slate-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <span 
                                className="h-3 w-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: categoryColor }}
                              />
                              {category}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {categoryEmails.length} email{categoryEmails.length !== 1 ? 's' : ''}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {categoryEmails.slice(0, 5).map((email, idx) => (
                                <a
                                  key={idx}
                                  href={email.webLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-white rounded hover:bg-slate-50 transition-colors block"
                                >
                                  <p className={`text-xs truncate ${
                                    email.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'
                                  }`}>
                                    {email.subject || '(No Subject)'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate mt-1">
                                    {email.fromName || email.from}
                                  </p>
                                </a>
                              ))}
                              {categoryEmails.length > 5 && (
                                <p className="text-[10px] text-slate-400 text-center pt-1">
                                  +{categoryEmails.length - 5} more
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Full Calendar Modal */}
      <FullCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        tasks={allTasks}
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