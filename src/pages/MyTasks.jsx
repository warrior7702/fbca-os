
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/components/shared/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  CheckCircle2, // Added
  Circle, // Added
  MoreVertical, // Added
  Filter // Added
} from "lucide-react";
import { format, isToday, parseISO, formatDistanceToNow, addDays, startOfWeek, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion"; // Added AnimatePresence
import TaskCalendar from "@/components/tasks/TaskCalendar";
import FullCalendarModal from "@/components/tasks/FullCalendarModal";
import TaskCard from "@/components/tasks/TaskCard";
import TaskDetailModal from "@/components/tasks/TaskDetailModal";
import EmailDetailModal from "@/components/emails/EmailDetailModal";
import { toast } from "sonner";
import ConnectionWarning from "@/components/shared/ConnectionWarning";
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

  // NEW: My Schedule state
  const [myScheduleEvents, setMyScheduleEvents] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [myApprovalGroups, setMyApprovalGroups] = useState([]);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState(null);
  const [showScheduleDetail, setShowScheduleDetail] = useState(false);


  const navigate = useNavigate();

  const createPageUrl = (pageName) => {
    switch (pageName) {
      case 'SupportTickets': return '/support-tickets';
      default: return `/${pageName.toLowerCase()}`;
    }
  };

  useEffect(() => {
    loadData();
    loadMySchedule(); // Load schedule on initial mount
  }, []);

  useEffect(() => {
    if (user) {
      loadSupportTickets();
    }
  }, [user]);

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

  const loadSupportTickets = async () => {
    setLoadingTickets(true);
    try {
      if (user?.email) {
        const allTickets = await base44.entities.Ticket.filter({
          assigned_to: user.email,
          status: { $in: ['open', 'in_progress', 'pending'] }
        });
        setSupportTickets(allTickets);
        console.log('✅ Support Tickets loaded:', allTickets.length);
      } else {
        console.warn('⚠️ User email not available for support ticket load.');
        setSupportTickets([]);
      }
    } catch (error) {
      console.error('Error loading support tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  // NEW: Load calendar events with my approval groups
  const loadMySchedule = async () => {
    setLoadingSchedule(true);
    try {
      console.log('🗓️ Loading My Schedule...');

      // First get my approval groups from pending approvals
      const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
      const approvals = approvalsResponse.data.pending_approvals || [];

      console.log('✅ My pending approvals:', approvals.length);

      // Extract unique resource names from my approvals
      const myResourceNames = [...new Set(approvals.map(a => a.resource_name).filter(Boolean))];
      setMyApprovalGroups(myResourceNames);
      console.log('📋 My approval resources:', myResourceNames);

      if (myResourceNames.length === 0) {
        console.log('⚠️ No pending approvals found for any resource - schedule will be empty');
        setMyScheduleEvents([]);
        setLoadingSchedule(false);
        return;
      }

      // Fetch calendar events
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      const allEvents = eventsResponse.data.events || [];

      console.log('📅 Total calendar events fetched:', allEvents.length);

      // Filter events that have resources matching my approval resources
      const myEvents = allEvents.filter(event => {
        if (!event.resources || event.resources.length === 0) {
          return false;
        }

        // Check if any of the event's resources match my approval resources
        const hasMyResource = event.resources.some(resource =>
          myResourceNames.includes(resource.name)
        );

        return hasMyResource;
      });

      console.log('🎯 Filtered events for my schedule:', myEvents.length);

      // Sort by date
      myEvents.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

      // DON'T fetch door codes here - we'll do it on-demand when user clicks an event
      console.log('✅ My Schedule loaded successfully:', myEvents.length, 'events');
      console.log('ℹ️ Door codes will be loaded when you click an event');
      
      setMyScheduleEvents(myEvents);
    } catch (error) {
      console.error('❌ Error loading schedule:', error);
      console.error('Error details:', error.message);
      toast.error('Failed to load schedule: ' + error.message);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // NEW: Load door code for a specific event when clicked
  const loadEventDoorCode = async (event) => {
    if (event.posted_door_code || event.loading_door_code) {
      return; // Already loaded or currently loading
    }

    // Mark as loading
    setMyScheduleEvents(prev => prev.map(e => 
      e.id === event.id ? { ...e, loading_door_code: true } : e
    ));

    try {
      const commentsResponse = await base44.functions.invoke('getPCOEventComments', {
        event_id: event.event_id
      });

      if (commentsResponse.data.comments) {
        const doorCodeComment = commentsResponse.data.comments.find(c =>
          c.body?.includes('🚪 Building Access Approved') && c.body?.includes('Door Code:')
        );

        if (doorCodeComment) {
          const match = doorCodeComment.body.match(/Door Code:\s*(\d+)/);
          if (match) {
            // Update the event with door code
            setMyScheduleEvents(prev => prev.map(e => 
              e.id === event.id 
                ? { ...e, posted_door_code: match[1], posted_by: doorCodeComment.created_by, loading_door_code: false } 
                : e
            ));
            
            // Also update selectedScheduleEvent if this is the one being viewed
            if (selectedScheduleEvent?.id === event.id) {
              setSelectedScheduleEvent(prev => ({
                ...prev,
                posted_door_code: match[1],
                posted_by: doorCodeComment.created_by
              }));
            }
            
            console.log('✅ Loaded door code for', event.name);
            return;
          }
        }
      }
      
      // No door code found - mark as loaded so we don't try again
      setMyScheduleEvents(prev => prev.map(e => 
        e.id === event.id ? { ...e, loading_door_code: false, no_door_code: true } : e
      ));
      
    } catch (error) {
      console.error('Error fetching door code for event:', event.event_id, error);
      // Mark as failed
      setMyScheduleEvents(prev => prev.map(e => 
        e.id === event.id ? { ...e, loading_door_code: false } : e
      ));
    }
  };

  const handleTaskClick = (task) => {
    if (task.source === 'microsoft_todo') {
      if (task.url) {
        window.open(task.url, '_blank', 'noopener,noreferrer');
      }
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

  console.log('📊 Total tasks:', allTasks.length, '(ClickUp:', clickupTasks.length, ', To Do:', todoTasks.length, ')');

  const myDayTasks = allTasks.filter(task =>
    task.due_date && isToday(new Date(task.due_date))
  );

  const tasks = allTasks; // Defined tasks for header description
  const completedCount = allTasks.filter(task =>
    task.status?.toLowerCase().includes('done') ||
    task.status?.toLowerCase().includes('complete') ||
    task.status?.toLowerCase().includes('closed')
  ).length; // Defined completedCount for header description

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

    return status
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {(!user?.clickup_access_token && !user?.microsoft_access_token) && (
          <ConnectionWarning />
        )}

        <AppHeader
          icon={ListChecks}
          title="My Tasks"
          description={`${tasks.length} task${tasks.length !== 1 ? 's' : ''} • ${completedCount} completed`}
          iconColor="from-indigo-500 to-blue-500"
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

        {/* NEW: My Schedule - Two Week Calendar */}
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-indigo-600" />
                  My Schedule
                </CardTitle>
                <p className="text-slate-600 text-sm mt-1">
                  Next 2 weeks • {myScheduleEvents.length} event{myScheduleEvents.length !== 1 ? 's' : ''} requiring your approval
                </p>
              </div>
              <Button onClick={loadMySchedule} disabled={loadingSchedule} variant="outline" size="sm">
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
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-slate-600">Loading your schedule...</p>
              </div>
            ) : myScheduleEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600">No upcoming events with your approval groups</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Two Week Calendar Grid */}
                {[0, 1].map((weekIndex) => {
                  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), weekIndex * 7);
                  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                  
                  return (
                    <div key={weekIndex} className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
                      {/* Week header */}
                      <div className="bg-indigo-100 px-3 py-2 border-b border-indigo-200">
                        <p className="text-sm font-semibold text-indigo-900">
                          Week of {format(weekStart, 'MMM d, yyyy')}
                        </p>
                      </div>
                      
                      {/* Day headers */}
                      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                        {weekDays.map((day) => (
                          <div key={day.toISOString()} className="text-center py-2 border-r border-slate-200 last:border-r-0">
                            <div className={`text-xs font-semibold ${
                              isSameDay(day, new Date()) ? 'text-indigo-600' : 'text-slate-600'
                            }`}>
                              {format(day, 'EEE')}
                            </div>
                            <div className={`text-sm font-bold mt-1 ${
                              isSameDay(day, new Date()) 
                                ? 'bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' 
                                : 'text-slate-900'
                            }`}>
                              {format(day, 'd')}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Events for each day */}
                      <div className="grid grid-cols-7 min-h-[120px]">
                        {weekDays.map((day) => {
                          const dayEvents = myScheduleEvents.filter(event => 
                            isSameDay(parseISO(event.starts_at), day)
                          );
                          
                          return (
                            <div 
                              key={day.toISOString()} 
                              className="border-r border-slate-200 last:border-r-0 p-2 space-y-1 overflow-y-auto max-h-[200px]"
                            >
                              {dayEvents.map((event) => (
                                <motion.div
                                  key={event.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="text-xs p-2 bg-indigo-100 hover:bg-indigo-200 rounded border border-indigo-300 cursor-pointer transition-all group"
                                  onClick={() => {
                                    setSelectedScheduleEvent(event);
                                    setShowScheduleDetail(true);
                                    // Load door code when event is clicked
                                    loadEventDoorCode(event);
                                  }}
                                >
                                  <div className="font-semibold text-indigo-900 truncate mb-1">
                                    {format(parseISO(event.starts_at), 'h:mm a')}
                                  </div>
                                  <div className="text-slate-700 font-medium truncate mb-1" title={event.name}>
                                    {event.name}
                                  </div>
                                  
                                  {/* Resources */}
                                  {event.resources && event.resources.length > 0 && (
                                    <div className="space-y-0.5 mb-1">
                                      {event.resources.slice(0, 2).map((resource, idx) => (
                                        <div key={idx} className="text-[10px] text-slate-600 truncate" title={`${resource.name} (${resource.kind})`}>
                                          • {resource.name}
                                        </div>
                                      ))}
                                      {event.resources.length > 2 && (
                                        <div className="text-[10px] text-slate-500">
                                          +{event.resources.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Door Code Badge */}
                                  {event.posted_door_code && (
                                    <div className="flex items-center gap-1 mt-1 p-1 bg-white rounded border border-indigo-400">
                                      <Key className="w-3 h-3 text-indigo-700 flex-shrink-0" />
                                      <span className="text-[10px] font-mono font-bold text-indigo-700">
                                        {event.posted_door_code}#
                                      </span>
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>


        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300">
                  Today
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{myDayTasks.length}</p>
              <p className="text-sm text-slate-600">Tasks Due</p>
            </CardContent>
          </Card>

          {/* Support Tickets Card */}
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

        {/* Support Tickets Section */}
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

      {/* Full Calendar Modal */}
      <FullCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        tasks={allTasks}
        onTaskClick={handleTaskClick}
        onTaskUpdate={async (taskId, updates) => {
          try {
            await base44.functions.invoke('updateClickUpTask', { // Changed to generic updateClickUpTask
              task_id: taskId,
              due_date: updates.due_date,
              // Add other updatable fields as needed
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

      {/* Schedule Event Detail Modal */}
      <Dialog open={showScheduleDetail} onOpenChange={setShowScheduleDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedScheduleEvent?.name}</DialogTitle>
            <DialogDescription>
              {selectedScheduleEvent && format(parseISO(selectedScheduleEvent.starts_at), 'EEEE, MMMM d, yyyy • h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {selectedScheduleEvent && (
            <div className="space-y-4 mt-4">
              {/* Time */}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-medium">
                    {format(parseISO(selectedScheduleEvent.starts_at), 'h:mm a')} - {format(parseISO(selectedScheduleEvent.ends_at), 'h:mm a')}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({formatDistanceToNow(parseISO(selectedScheduleEvent.starts_at), { addSuffix: true })})
                  </span>
                </div>
              </div>

              {/* Resources */}
              {selectedScheduleEvent.resources && selectedScheduleEvent.resources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">
                    Rooms & Resources ({selectedScheduleEvent.resources.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedScheduleEvent.resources.map((resource, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div>
                          <p className="font-medium text-slate-900">{resource.name}</p>
                          <p className="text-xs text-slate-500">{resource.kind}</p>
                        </div>
                        {resource.approval_status && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              resource.approval_status === 'A' ? 'bg-green-50 border-green-300 text-green-700' : 
                              resource.approval_status === 'P' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 
                              'bg-red-50 border-red-300 text-red-700'
                            }`}
                          >
                            {resource.approval_status === 'A' ? 'Approved' : 
                             resource.approval_status === 'P' ? 'Pending' : 
                             'Rejected'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Door Code - with loading state */}
              {selectedScheduleEvent.loading_door_code ? (
                <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-700 animate-spin" />
                  <span className="text-sm text-indigo-900">Loading door code...</span>
                </div>
              ) : selectedScheduleEvent.posted_door_code ? (
                <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-5 h-5 text-indigo-700" />
                    <span className="text-sm font-semibold text-indigo-900">Door Code Posted</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-700 my-2">
                    {selectedScheduleEvent.posted_door_code}#
                  </div>
                  {selectedScheduleEvent.posted_by && (
                    <p className="text-xs text-indigo-600">
                      Posted by: {selectedScheduleEvent.posted_by}
                    </p>
                  )}
                </div>
              ) : selectedScheduleEvent.no_door_code ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-sm text-slate-500">No door code posted yet</p>
                </div>
              ) : null}

              {/* Summary/Description */}
              {selectedScheduleEvent.summary && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">Details</h3>
                  <p className="text-sm text-slate-600">{selectedScheduleEvent.summary}</p>
                </div>
              )}

              {/* Tags */}
              {selectedScheduleEvent.tags && selectedScheduleEvent.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedScheduleEvent.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => window.open(`https://calendar.planningcenteronline.com/events/${selectedScheduleEvent.event_id}`, '_blank')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View in Planning Center
                </Button>
                <Button
                  onClick={() => setShowScheduleDetail(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Detail Modal */}
      <EmailDetailModal
        open={showEmailDetail}
        onOpenChange={setShowEmailDetail}
        email={selectedEmail}
      />
    </div>
  );
}
