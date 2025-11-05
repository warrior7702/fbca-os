
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
  Calendar as CalendarIcon,
  Mail,
  ExternalLink,
  Loader2,
  Paperclip,
  Tag,
  Maximize2,
  ListChecks,
  Info,
  RefreshCw,
  Ticket as TicketIcon,
  AlertCircle,
  Sparkles,
  User,
  Key,
  Clock,
} from "lucide-react";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import TaskCalendar from "../components/tasks/TaskCalendar";
import ScheduleCalendar from "../components/tasks/ScheduleCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import EmailDetailModal from "../components/emails/EmailDetailModal";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { useNavigate } from "react-router-dom";

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
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [supportTickets, setSupportTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [myScheduleEvents, setMyScheduleEvents] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const navigate = useNavigate();

  const createPageUrl = (pageName) => {
    switch (pageName) {
      case 'SupportTickets': return '/support-tickets';
      default: return `/${pageName.toLowerCase()}`;
    }
  };

  const loadMySchedule = async () => {
    console.log('🗓️ ========== LOADING MY SCHEDULE ==========');
    console.log('User:', user);
    
    setLoadingSchedule(true);
    
    try {
      // Call the dedicated backend function that handles everything
      console.log('📞 Calling getMySchedule...');
      const response = await base44.functions.invoke('getMySchedule');
      
      console.log('✅ Response:', response.data);
      
      if (!response.data) {
        throw new Error('No data returned from getMySchedule');
      }
      
      const events = response.data.events || [];
      const resourceCount = response.data.resources_count || 0;
      
      console.log(`✅ Got ${events.length} events for ${resourceCount} resources`);
      
      if (events.length === 0) {
        console.log('⚠️ No events found');
        toast.info(response.data.message || 'No upcoming events found');
      }
      
      setMyScheduleEvents(events);
      console.log('✅ SUCCESS! Schedule loaded');
      
    } catch (error) {
      console.error('❌ FATAL ERROR in loadMySchedule:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      const errorMsg = error.message || 'Unknown error';
      toast.error(`Failed to load schedule: ${errorMsg}`);
      
      setMyScheduleEvents([]);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh clicked - refreshing schedule');
    await loadMySchedule();
    toast.success('Schedule refreshed!');
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    console.log('📢 User changed:', user?.email);
    if (user) {
      loadSupportTickets();
      console.log('📢 About to call loadMySchedule()');
      loadMySchedule();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setLoadingEmails(true);
    try {
      const currentUser = await base44.auth.me();
      console.log('✅ Current user loaded:', currentUser.email);
      setUser(currentUser);

      const taskPromises = [];

      if (currentUser.clickup_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMyClickUpTasks')
            .then(res => ({ type: 'clickup', data: res.data.tasks || [] }))
            .catch(() => ({ type: 'clickup', data: [] }))
        );
      }

      if (currentUser.microsoft_access_token) {
        taskPromises.push(
          base44.functions.invoke('getMicrosoftToDo')
            .then(res => ({ type: 'todo', data: res.data.tasks || res.data || [] }))
            .catch(() => ({ type: 'todo', data: [] }))
        );

        taskPromises.push(
          base44.functions.invoke('getCategorizedEmails')
            .then(res => ({ type: 'emails', data: res.data.categorized || {} }))
            .catch(() => ({ type: 'emails', data: {} }))
        );
      }

      const results = await Promise.all(taskPromises);

      results.forEach(result => {
        if (result.type === 'clickup') setClickupTasks(result.data);
        else if (result.type === 'todo') setTodoTasks(result.data);
        else if (result.type === 'emails') setEmails({ categorized: result.data });
      });

      setLoadingEmails(false);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupportTickets = async () => {
    setLoadingTickets(true);
    try {
      if (user?.email) {
        const allTickets = await base44.entities.Ticket.filter({
          assigned_to: user.email,
          status: { $in: ['open', 'in_progress', 'pending'] }
        });
        setSupportTickets(allTickets);
      }
    } catch (error) {
      console.error('Error loading support tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleTaskClick = (task) => {
    if (task.source === 'microsoft_todo') {
      if (task.url) window.open(task.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const handleCompleteTask = async (task, e) => {
    e.stopPropagation();
    try {
      if (task.source === 'microsoft_todo') {
        await base44.functions.invoke('completeMicrosoftToDoTask', {
          list_id: task.list_id,
          task_id: task.id
        });
        toast.success('Task completed!');
      } else {
        await base44.functions.invoke('updateClickUpTask', {
          task_id: task.id,
          closed: true
        });
        toast.success('Task closed!');
      }
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  const handleTaskUpdate = async () => {
    await loadData();
  };

  const allTasks = [...clickupTasks, ...todoTasks];
  const myDayTasks = allTasks.filter(task => task.due_date && isToday(new Date(task.due_date)));

  const LIST_COLORS = {
    'Special Event Master': '#22c55e',
    'Facilities Work Orders': '#0ea5e9',
    'Marketing': '#f59e0b',
    'IT & Technology': '#8b5cf6',
    'Worship & Production': '#ec4899',
    'Admin & Operations': '#6366f1',
    'default': '#94a3b8'
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
    return status.split(/[\s_-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const getTicketPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
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
        {(!user?.clickup_access_token && !user?.microsoft_access_token) && <ConnectionWarning />}

        <AppHeader
          icon={ListChecks}
          title="My Tasks"
          description={`Welcome back, ${displayName}`}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowFullCalendar(true)} variant="outline" size="sm">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Calendar
              </Button>
              <Button onClick={loadData} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync
                  </>
                )}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300">Today</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{myDayTasks.length}</p>
              <p className="text-sm text-slate-600">Tasks Due</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('SupportTickets'))}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TicketIcon className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                  {loadingTickets ? <Loader2 className="h-3 w-3 animate-spin" /> : supportTickets.length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{supportTickets.length}</p>
              <p className="text-sm text-slate-600">Support Tickets</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-green-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-green-600" />
                  My Schedule
                </CardTitle>
                <p className="text-slate-600 text-sm mt-1">
                  Upcoming events with your door codes • {myScheduleEvents.length} event{myScheduleEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button 
                onClick={handleManualRefresh} 
                disabled={loadingSchedule} 
                variant="outline" 
                size="sm"
                title="Refresh schedule"
              >
                {loadingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSchedule ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                <p className="text-slate-600">Loading your schedule...</p>
              </div>
            ) : myScheduleEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">No upcoming events found</p>
              </div>
            ) : (
              <ScheduleCalendar events={myScheduleEvents} weekCount={2} />
            )}
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
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

        {user?.microsoft_access_token && emails.categorized && Object.keys(emails.categorized).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
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
                  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

                  return (
                    <Card key={category} className="bg-slate-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: categoryColor }}
                            />
                            {category}
                          </span>
                          <Badge variant="secondary">{categoryEmails.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                          {categoryEmails.slice(0, 5).map((email, idx) => (
                            <motion.div
                              key={email.messageId || email.id}
                              whileHover={{ scale: 1.01 }}
                              onClick={() => {
                                setSelectedEmail(email);
                                setShowEmailDetail(true);
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

        {supportTickets.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TicketIcon className="w-5 h-5 text-purple-600" />
                  My Support Tickets ({supportTickets.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(createPageUrl('SupportTickets'))}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {supportTickets.slice(0, 5).map((ticket) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(createPageUrl('SupportTickets'))}
                >
                  <div className={`w-1 h-full rounded-full ${getTicketPriorityColor(ticket.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {ticket.subject}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">{ticket.ticket_number}</span>
                      {ticket.category && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{ticket.category.replace('_', ' ')}</span>
                        </>
                      )}
                      {ticket.created_date && (
                        <>
                          <span>•</span>
                          <span>{format(new Date(ticket.created_date), 'MMM d, h:mm a')}</span>
                        </>
                      )}
                    </div>
                    {ticket.suggested_solution && (
                      <div className="mt-2 flex items-start gap-1 text-xs text-purple-600">
                        <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">AI suggested solution available</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {supportTickets.length > 5 && (
                <p className="text-xs text-slate-500 text-center pt-2">
                  +{supportTickets.length - 5} more tickets
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

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

      <TaskDetailModal
        open={showTaskDetail}
        onOpenChange={setShowTaskDetail}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
      />

      <EmailDetailModal
        open={showEmailDetail}
        onOpenChange={setShowEmailDetail}
        email={selectedEmail}
      />
    </div>
  );
}
