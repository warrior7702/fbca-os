
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/shared/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckSquare,
  Calendar,
  Mail,
  ExternalLink,
  Loader2,
  Paperclip,
  Tag,
  Maximize2,
  ListChecks,
  Info, // Added Info icon
  RefreshCw // Added RefreshCw icon
} from "lucide-react";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import EmailDetailModal from "../components/emails/EmailDetailModal";
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
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailDetail, setShowEmailDetail] = useState(false); // Re-used for new modal trigger

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadingEmails(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      console.log('🔄 Starting data load...');
      console.log('ClickUp connected:', !!currentUser.clickup_access_token);
      console.log('Microsoft connected:', !!currentUser.microsoft_access_token);

      if (!currentUser.clickup_access_token && !currentUser.microsoft_access_token) {
        toast.error('Please connect ClickUp or Microsoft 365 in Settings');
      }

      // Load tasks in parallel for faster loading
      const taskPromises = [];

      if (currentUser.clickup_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMyClickUpTasks')
            .then(res => {
              console.log('✅ ClickUp tasks loaded:', res.data.tasks?.length || 0);
              if (res.data.tasks?.length > 0) {
                console.log('Sample ClickUp task:', res.data.tasks[0]);
              }
              return { type: 'clickup', data: res.data.tasks || [] };
            })
            .catch(error => {
              console.error('❌ Error fetching ClickUp tasks:', error);
              toast.error('Failed to load ClickUp tasks');
              return { type: 'clickup', data: [] };
            })
        );
      }

      if (currentUser.microsoft_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMicrosoftToDo')
            .then(res => {
              // Fix To Do API error: Check for 'tasks' property or if 'res.data' itself is the array
              const tasks = res.data.tasks || res.data || [];
              console.log('✅ Microsoft To Do tasks loaded:', tasks.length || 0);
              if (tasks.length > 0) {
                console.log('Sample To Do task:', tasks[0]);
                console.log('All To Do tasks:', tasks);
              } else {
                console.log('⚠️ No To Do tasks returned from API');
              }
              return { type: 'todo', data: tasks };
            })
            .catch(error => {
              console.error('❌ Error fetching Microsoft To Do:', error);
              // Check if it's a 403 permission error
              if (error.response?.status === 403) {
                toast.error('Microsoft To Do access denied. Please reconnect Microsoft 365 in Settings to grant Tasks permission.');
              } else {
                toast.error('Failed to load Microsoft To Do');
              }
              return { type: 'todo', data: [] };
            })
        );

        taskPromises.push(
          base44.functions.invoke('getCategorizedEmails')
            .then(res => {
              console.log('✅ Emails loaded');
              return { type: 'emails', data: res.data.categorized || {} };
            })
            .catch(error => {
              console.error('❌ Error fetching emails:', error);
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

      console.log('✅ All data loaded successfully');
      setLoadingEmails(false);

    } catch (error) {
      console.error("❌ Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    // Microsoft To Do tasks open in browser
    if (task.source === 'microsoft_todo') {
      if (task.url) {
        window.open(task.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // ClickUp tasks open modal
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const handleCompleteTask = async (task, e) => {
    e.stopPropagation(); // Prevent card click

    try {
      if (task.source === 'microsoft_todo') {
        // Complete Microsoft To Do task
        await base44.functions.invoke('completeMicrosoftToDoTask', {
          list_id: task.list_id,
          task_id: task.id
        });
        toast.success('Task completed!');
      } else {
        // Complete ClickUp task
        await base44.functions.invoke('updateClickUpTask', {
          task_id: task.id,
          closed: true
        });
        toast.success('Task closed!');
      }

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  const handleTaskUpdate = async () => {
    // Reload tasks after update
    await loadData();
  };

  // handleEmailClick function removed as per new logic

  // Combine all tasks
  const allTasks = [...clickupTasks, ...todoTasks];

  console.log('📊 Total tasks:', allTasks.length, '(ClickUp:', clickupTasks.length, ', To Do:', todoTasks.length, ')');

  // My Day: Tasks due today from both ClickUp AND Microsoft To Do
  const myDayTasks = allTasks.filter(task =>
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

        <AppHeader
          icon={ListChecks}
          title="My Tasks"
          description={`Welcome back, ${displayName}`}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {/* My Day */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                My Day
              </CardTitle>
              <Badge variant="secondary">{myDayTasks.length} task{myDayTasks.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {myDayTasks.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No tasks due today! 🎉</p>
            ) : (
              <div className="space-y-3">
                {myDayTasks.map((task) => {
                  const isMicrosoftToDo = task.source === 'microsoft_todo';
                  const listColor = isMicrosoftToDo ? '#0078d4' : (LIST_COLORS[task.list_name] || LIST_COLORS.default);

                  return (
                    <div
                      key={`${task.source}-${task.id}`}
                      onClick={() => handleTaskClick(task)}
                      className="p-4 bg-white hover:bg-slate-50 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
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
                            {isMicrosoftToDo ? (
                              <span className="text-xs text-slate-500 font-medium">From To Do</span>
                            ) : task.list_name && (
                              <span className="text-xs text-slate-500 font-medium">{task.list_name}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleCompleteTask(task, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <CheckSquare className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
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

        {/* Microsoft To Do Tasks - ALL TASKS */}
        {user?.microsoft_access_token && todoTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-600" />
                Microsoft To Do
              </CardTitle>
              <CardDescription>{todoTasks.length} task{todoTasks.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todoTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="p-4 bg-white hover:bg-slate-50 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    style={{ borderLeftColor: '#0078d4' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: '#0078d4' }}
                          />
                          <h3 className="font-semibold text-slate-900">{task.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getStatusColor(task.status)}>
                            {formatStatus(task.status)}
                          </Badge>
                          <span className="text-xs text-slate-500 font-medium">{task.list_name}</span>
                          {task.due_date && (
                            <span className="text-xs text-slate-400">
                              Due: {format(new Date(task.due_date), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleCompleteTask(task, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <CheckSquare className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug info for Microsoft To Do */}
        {user?.microsoft_access_token && todoTasks.length === 0 && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-4">
              <p className="text-sm text-slate-700">
                ℹ️ No Microsoft To Do tasks found. Check the console (F12) for details.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Categorized Emails */}
        {user?.microsoft_access_token && emails.categorized && Object.keys(emails.categorized).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4" // Added space-y-4 for separation between the main title and category cards
          >
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Categorized Emails
            </h2>
            {loadingEmails ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(emails.categorized).map(([category, categoryEmails]) => {
                  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.default; // Still useful for the color dot
                  
                  return (
                    <Card key={category} className="bg-slate-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {/* Re-added color dot for category as per original styling, alongside Tag icon */}
                            <span 
                              className="h-3 w-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: categoryColor }}
                            />
                            {category}
                          </span>
                          <Badge variant="secondary">{categoryEmails.length}</Badge>
                        </CardTitle>
                        {/* Removed CardDescription here as it's now part of CardTitle */}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2"> {/* Added pr-2 to prevent scrollbar overlap */}
                          {categoryEmails.slice(0, 5).map((email, idx) => (
                            <motion.div
                              key={email.messageId || email.id} // Use messageId or id as fallback
                              whileHover={{ scale: 1.01 }}
                              onClick={() => {
                                setSelectedEmail(email);
                                setShowEmailDetail(true); // Open the detail modal
                              }}
                              className="group cursor-pointer w-full p-2 bg-white rounded hover:bg-blue-50 hover:shadow-sm transition-all flex flex-col"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs truncate ${
                                    email.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'
                                  }`}>
                                    {email.subject || '(No Subject)'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate mt-1">
                                    From: {email.fromName || email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown Sender"}
                                  </p>
                                  {email.bodyPreview && (
                                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                      {email.bodyPreview}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {email.hasAttachments && (
                                    <Paperclip className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          {categoryEmails.length > 5 && (
                            <p className="text-[10px] text-slate-400 text-center pt-1">
                              +{categoryEmails.length - 5} more emails
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
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

      {/* Email Detail Modal */}
      <EmailDetailModal
        open={showEmailDetail}
        onOpenChange={setShowEmailDetail}
        email={selectedEmail}
      />
    </div>
  );
}
