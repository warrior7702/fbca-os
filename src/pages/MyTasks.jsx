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
import ScheduleEventDetailModal from "../components/tasks/ScheduleEventDetailModal";
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
  const [listsTasks, setListsTasks] = useState([]);
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
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState(null);
  const [showScheduleEventDetail, setShowScheduleEventDetail] = useState(false);
  const [userDepartments, setUserDepartments] = useState([]);
  const [deptTickets, setDeptTickets] = useState([]);

  const navigate = useNavigate();

  const createPageUrl = (pageName) => {
    switch (pageName) {
      case 'SupportTickets': return '/support-tickets';
      default: return `/${pageName.toLowerCase()}`;
    }
  };

  const loadMySchedule = async () => {
    console.log('🗓️ ========== LOADING MY SCHEDULE ==========');
    
    setLoadingSchedule(true);
    
    try {
      console.log('📞 Calling getMySchedule (PCO events with door codes)...');
      
      const pcoResponse = await base44.functions.invoke('getMySchedule');
      
      console.log('✅ PCO Response:', pcoResponse.data);
      
      if (!pcoResponse.data) {
        throw new Error('No PCO data returned');
      }
      
      const pcoEvents = pcoResponse.data.events || [];
      
      console.log(`✅ Got ${pcoEvents.length} PCO events`);
      console.log(`📊 I'm in ${pcoResponse.data.my_groups_count || 0} approval groups`);
      console.log(`📊 Managing ${pcoResponse.data.my_resources_count || 0} resources`);

      let microsoftMeetings = [];
      if (user?.microsoft_access_token) {
        console.log('📞 Loading Microsoft meetings...');
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const msResponse = await base44.functions.invoke('getMicrosoftCalendar', {
            timezone: timezone
          });
          
          if (msResponse.data && msResponse.data.events) {
            microsoftMeetings = msResponse.data.events.map(meeting => ({
              id: `ms-${meeting.id}`,
              name: meeting.subject || 'Untitled Meeting',
              starts_at: meeting.start,
              ends_at: meeting.end,
              source: 'microsoft',
              meetingLink: meeting.onlineMeeting?.joinUrl || null,
              location: meeting.location?.displayName || null,
              organizer: meeting.organizer?.emailAddress?.name || meeting.organizer?.emailAddress?.address || null,
              attendees: meeting.attendees?.map(att => ({
                email: att.emailAddress?.address,
                name: att.emailAddress?.name,
                type: att.type,
                status: att.status?.response,
              })) || [],
              isOnlineMeeting: meeting.isOnlineMeeting,
              responseStatus: meeting.responseStatus?.response || null,
              resources: [],
              posted_door_code: null,
              access_time: null,
              type: meeting.type, 
              sensitivity: meeting.sensitivity, 
            }));
            console.log(`✅ Got ${microsoftMeetings.length} Microsoft meetings`);
          }
        } catch (error) {
          console.warn('⚠️ Failed to load Microsoft meetings:', error.message);
        }
      }

      const allEvents = [...pcoEvents, ...microsoftMeetings];
      allEvents.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      
      console.log(`✅ Total events: ${allEvents.length} (${pcoEvents.length} PCO + ${microsoftMeetings.length} Microsoft)`);
      
      setMyScheduleEvents(allEvents);
      console.log('✅ SUCCESS! Schedule loaded');
      
    } catch (error) {
      console.error('❌ ERROR in loadMySchedule:');
      console.error('Error message:', error.message);
      
      toast.error('Failed to load schedule');
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

  const handleScheduleEventClick = (event) => {
    setSelectedScheduleEvent(event);
    setShowScheduleEventDetail(true);
  };

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
          base44.functions.invoke('getMicrosoftLists')
            .then(res => ({ type: 'lists', data: res.data.tasks || [] }))
            .catch(() => ({ type: 'lists', data: [] }))
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
        else if (result.type === 'lists') setListsTasks(result.data);
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
          status: { $in: ['open', 'awaiting_information', 'awaiting_parts'] }
        });
        setSupportTickets(allTickets);
        
        // Load user's departments and department tickets
        try {
          const rolesResponse = await base44.functions.invoke('getUsersWithTicketRoles');
          if (rolesResponse.data.success) {
            const userData = rolesResponse.data.allUsers.find(u => u.user_email === user.email);
            if (userData) {
              setUserDepartments(userData.departments || []);
              
              // Get all tickets for department
              const allDeptTickets = await base44.entities.Ticket.list('-created_date');
              
              // Filter for department tickets
              const getDepartment = (category) => {
                const deptMap = {
                  'technology': 'it',
                  'technical': 'it',
                  'maintenance': 'facilities',
                  'cleaning': 'facilities',
                  'facility': 'facilities',
                  'facility_cleaning': 'facilities',
                  'av_production': 'comms',
                  'marketing': 'comms',
                  'social_media': 'comms',
                  'communications': 'comms'
                };
                return deptMap[category] || 'other';
              };
              
              const deptFiltered = allDeptTickets.filter(t => {
                const ticketDept = getDepartment(t.category);
                return userData.departments.some(dept => 
                  ticketDept === dept.toLowerCase().replace(' ', '_')
                ) && ['open', 'awaiting_information', 'awaiting_parts'].includes(t.status);
              });
              
              setDeptTickets(deptFiltered);
            }
          }
        } catch (err) {
          console.error('Error loading department tickets:', err);
        }
      }
    } catch (error) {
      console.error('Error loading support tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleTaskClick = (task) => {
    if (task.source === 'microsoft_lists' && task.url) {
      window.open(task.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const handleCompleteTask = async (task, e) => {
    e.stopPropagation();
    try {
      if (task.source === 'microsoft_lists') {
        await base44.functions.invoke('updateMicrosoftListItem', {
          siteId: task.site_id,
          listId: task.list_id,
          itemId: task.id,
          completed: true
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

  const allTasks = [...clickupTasks, ...listsTasks];
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

  const eventsToday = myScheduleEvents.filter(event => {
    const eventDate = new Date(event.starts_at);
    return isToday(eventDate);
  }).length;

  const meetingsToday = myScheduleEvents.filter(event => {
    const eventDate = new Date(event.starts_at);
    return isToday(eventDate) && event.source === 'microsoft';
  }).length;

  const ticketsDueToday = supportTickets.filter(ticket => {
    if (!ticket.due_date) return false;
    return isToday(new Date(ticket.due_date));
  }).length;

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
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 overflow-auto pb-20">
      <div className="max-w-7xl mx-auto p-2 sm:p-6 space-y-3 sm:space-y-6">
        {(!user?.clickup_access_token && !user?.microsoft_access_token) && <ConnectionWarning />}

        <AppHeader
          icon={ListChecks}
          title="My Tasks"
          description={`Welcome back, ${displayName}`}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowFullCalendar(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
                <CalendarIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button onClick={loadData} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none" size="sm">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sync</span>
                  </>
                )}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between mb-1">
                <CalendarIcon className="w-4 h-4 text-green-600" />
                <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                  {loadingSchedule ? <Loader2 className="h-3 w-3 animate-spin" /> : eventsToday}
                </Badge>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">{eventsToday}</p>
              <p className="text-[10px] sm:text-sm text-slate-600">Events Today</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between mb-1">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                  {loadingSchedule ? <Loader2 className="h-3 w-3 animate-spin" /> : meetingsToday}
                </Badge>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">{meetingsToday}</p>
              <p className="text-[10px] sm:text-sm text-slate-600">Meetings Today</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer col-span-2 sm:col-span-1" onClick={() => navigate(createPageUrl('SupportTickets'))}>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between mb-1">
                <TicketIcon className="w-4 h-4 text-purple-600" />
                <p className="text-[10px] sm:text-xs text-slate-500">My Tickets</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">{supportTickets.length}</p>
                  <p className="text-[10px] sm:text-xs text-slate-600">Open</p>
                </div>
                <div className="h-6 sm:h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-orange-700">{ticketsDueToday}</p>
                  <p className="text-[10px] sm:text-xs text-slate-600">Due Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-green-200 bg-white">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  My Schedule
                </CardTitle>
                <p className="text-slate-600 text-xs sm:text-sm mt-1">
                  Upcoming events • {myScheduleEvents.length} event{myScheduleEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSchedule ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">Loading your schedule...</p>
              </div>
            ) : myScheduleEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 text-sm">No upcoming events found</p>
              </div>
            ) : (
              <ScheduleCalendar 
                events={myScheduleEvents}
                tickets={supportTickets}
                weekCount={1}
                onEventClick={handleScheduleEventClick}
                onTicketClick={(ticket) => navigate(`/ticket-detail?id=${ticket.id}`)}
              />
            )}
          </CardContent>
        </Card>

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
            <CardContent className="space-y-2 sm:space-y-3">
              {supportTickets.slice(0, 5).map((ticket) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-2 sm:p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(createPageUrl('SupportTickets'))}
                >
                  <div className={`w-1 h-full rounded-full ${getTicketPriorityColor(ticket.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {ticket.subject}
                      </p>
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-600 line-clamp-2 mb-1 sm:mb-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-slate-500 flex-wrap">
                      <span className="font-mono">{ticket.ticket_number}</span>
                      {ticket.category && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="capitalize hidden sm:inline">{ticket.category.replace('_', ' ')}</span>
                        </>
                      )}
                      {ticket.created_date && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{format(new Date(ticket.created_date), 'MMM d, h:mm a')}</span>
                        </>
                      )}
                    </div>
                    {ticket.suggested_solution && (
                      <div className="mt-1 sm:mt-2 flex items-start gap-1 text-[10px] sm:text-xs text-purple-600">
                        <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">AI solution</span>
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
                  const isMicrosoftLists = task.source === 'microsoft_lists';
                  const listColor = isMicrosoftLists ? '#0078d4' : (LIST_COLORS[task.list_name] || LIST_COLORS.default);

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
                            {isMicrosoftLists ? (
                              <span className="text-xs text-slate-500 font-medium">From Lists</span>
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

        {user?.microsoft_access_token && listsTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-600" />
                Microsoft Lists
              </CardTitle>
              <CardDescription>{listsTasks.length} task{listsTasks.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {listsTasks.map((task) => (
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
                          {task.site_name && (
                            <span className="text-xs text-slate-400">{task.site_name}</span>
                          )}
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {Object.entries(emails.categorized).map(([category, categoryEmails]) => {
                  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

                  return (
                    <Card key={category} className="bg-slate-50">
                      <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-xs sm:text-sm flex items-center justify-between">
                          <span className="flex items-center gap-1 sm:gap-2">
                            <span
                              className="h-2 w-2 sm:h-3 sm:w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: categoryColor }}
                            />
                            <span className="truncate">{category}</span>
                          </span>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">{categoryEmails.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1.5 sm:space-y-2 max-h-[180px] sm:max-h-[200px] overflow-y-auto pr-1 sm:pr-2">
                          {categoryEmails.slice(0, 5).map((email, idx) => (
                            <motion.div
                              key={email.messageId || email.id}
                              whileHover={{ scale: 1.01 }}
                              onClick={() => {
                                setSelectedEmail(email);
                                setShowEmailDetail(true);
                              }}
                              className="group cursor-pointer w-full p-1.5 sm:p-2 bg-white rounded hover:bg-blue-50 hover:shadow-sm transition-all flex flex-col"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[10px] sm:text-xs truncate ${
                                    email.isRead ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'
                                  }`}>
                                    {email.subject || '(No Subject)'}
                                  </p>
                                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate mt-0.5 sm:mt-1">
                                    {email.fromName || email.from?.emailAddress?.name || "Unknown"}
                                  </p>
                                  {email.bodyPreview && (
                                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 hidden sm:block">
                                      {email.bodyPreview}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {email.hasAttachments && (
                                    <Paperclip className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
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

      <ScheduleEventDetailModal
        open={showScheduleEventDetail}
        onOpenChange={setShowScheduleEventDetail}
        event={selectedScheduleEvent}
      />
    </div>
  );
}