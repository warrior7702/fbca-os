
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckSquare, 
  Calendar, 
  Mail, 
  ExternalLink, 
  Loader2,
  Paperclip,
  Tag,
  Maximize2,
  ListChecks
} from "lucide-react";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
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
  const [emails, setEmails] = useState({ categorized: {} });
  const [loading, setLoading] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

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

      // Load tasks in parallel for faster loading
      const taskPromises = [];
      
      if (currentUser.clickup_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMyClickUpTasks')
            .then(res => ({ type: 'clickup', data: res.data.tasks || [] }))
            .catch(error => {
              console.error('Error fetching ClickUp tasks:', error);
              toast.error('Failed to load ClickUp tasks');
              return { type: 'clickup', data: [] };
            })
        );
      }

      if (currentUser.microsoft_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMicrosoftToDo')
            .then(res => ({ type: 'todo', data: res.data.tasks || [] }))
            .catch(error => {
              console.error('Error fetching Microsoft To Do:', error);
              toast.error('Failed to load Microsoft To Do');
              return { type: 'todo', data: [] };
            })
        );

        taskPromises.push(
          base44.functions.invoke('getCategorizedEmails')
            .then(res => ({ type: 'emails', data: res.data.categorized || {} }))
            .catch(error => {
              console.error('Error fetching emails:', error);
              toast.error('Failed to load emails');
              return { type: 'emails', data: {} };
            })
        );
      }

      // Wait for all to complete in parallel
      const results = await Promise.all(taskPromises);
      
      results.forEach(result => {
        if (result.type === 'clickup') {
          setClickupTasks(result.data);
        } else if (result.type === 'todo') {
          setTodoTasks(result.data);
        } else if (result.type === 'emails') {
          setEmails({ categorized: result.data });
        }
      });

      setLoadingEmails(false);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    // Open task detail modal instead of external link
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const handleTaskUpdate = async () => {
    // Reload tasks after update
    await loadData();
  };

  // Combine all tasks
  const allTasks = [...clickupTasks, ...todoTasks];
  
  const todayTasks = allTasks.filter(task => 
    task.due_date && isToday(new Date(task.due_date))
  );

  const LIST_COLORS = {
    'Special Event Master': '#22c55e', // green-500
    'Facilities Work Orders': '#0ea5e9', // sky-500
    'Marketing': '#f59e0b', // amber-500
    'IT & Technology': '#8b5cf6', // violet-500
    'Worship & Production': '#ec4899', // pink-500
    'Admin & Operations': '#6366f1', // indigo-500
    'default': '#94a3b8' // slate-400
  };

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
    
    // Split by spaces, hyphens, or underscores
    return status
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Convert Outlook webLink to desktop protocol
  const getOutlookDesktopLink = (email) => {
    // Extract message ID from webLink if possible
    // Format: outlookmsgid:<message-id>
    // For now, we'll use the webLink but with outlook: protocol
    return email.webLink?.replace('https://outlook.office365.com', 'outlook:');
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

        {/* Today's Tasks */}
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
              <div className="space-y-3">
                {todayTasks.map((task) => {
                  const listColor = LIST_COLORS[task.list_name] || LIST_COLORS.default;
                  const isMicrosoftToDo = task.source === 'microsoft_todo';
                  
                  return (
                    <div
                      key={`${task.source}-${task.id}`}
                      onClick={() => handleTaskClick(task)}
                      className="p-4 bg-white hover:bg-slate-50 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      style={{ borderLeftColor: listColor }}
                    >
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
                            <Badge className={getStatusColor(task.status)}>
                              {formatStatus(task.status)}
                            </Badge>
                            {task.list_name && (
                              <span className="text-xs text-slate-500 font-medium">{task.list_name}</span>
                            )}
                            {isMicrosoftToDo && (
                              <Badge variant="outline" className="text-xs">Microsoft To Do</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

        {/* Categorized Emails */}
        {user?.microsoft_access_token && emails.categorized && Object.keys(emails.categorized).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Categorized Emails
              </CardTitle>
              <CardDescription>
                {Object.keys(emails.categorized).length} categor{Object.keys(emails.categorized).length !== 1 ? 'ies' : 'y'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmails ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : (
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
                                href={getOutlookDesktopLink(email)}
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
              )}
            </CardContent>
          </Card>
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

      {/* Task Detail Modal */}
      <TaskDetailModal
        open={showTaskDetail}
        onOpenChange={setShowTaskDetail}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
      />
    </div>
  );
}
