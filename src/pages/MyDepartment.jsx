import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  Users,
  Loader2,
  Ticket,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Crown,
  ArrowLeft,
  MousePointerClick,
  Zap,
  Mail,
  Workflow,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingDown,
  MapPin,
  RepeatIcon,
  GitBranch,
  Calendar,
  BarChart3,
  AlertCircle,
  Target,
  Flame,
  Plus,
  GripVertical,
  UserPlus,
  CalendarClock,
  Send,
  LayoutGrid,
  Folder
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, subDays, isAfter, isBefore, differenceInHours, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeptTaskDetailModal from "@/components/tasks/DeptTaskDetailModal";
import RoutineTaskDetailModal from "@/components/tasks/RoutineTaskDetailModal";
import { differenceInSeconds } from "date-fns";

function RoomFlowCountdown({ pcoEvents }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Find next PCO event with Room Setup or Maintenance resource
  const upcomingEvents = (pcoEvents || [])
    .filter(event => {
      if (!event.starts_at) return false;
      const eventDate = new Date(event.starts_at);
      return eventDate > now;
    })
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const nextEvent = upcomingEvents[0];

  if (!nextEvent) {
    return (
      <Card className="border-2 border-slate-200 bg-white">
        <CardContent className="p-6 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No upcoming room setups or maintenance requests</p>
        </CardContent>
      </Card>
    );
  }

  const eventDate = new Date(nextEvent.starts_at);
  const totalSeconds = Math.max(0, differenceInSeconds(eventDate, now));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Get resource type from resources array
  const resourceType = nextEvent.resources?.find(r => 
    r.name?.toLowerCase().includes('room setup') || 
    r.name?.toLowerCase().includes('maintenance')
  )?.name || 'Room Setup';

  return (
    <Card className="border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-100 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                Next Up
              </Badge>
              <Badge variant="outline" className="text-xs">
                {resourceType}
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{nextEvent.name}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {nextEvent.rooms && nextEvent.rooms.length > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {nextEvent.rooms.map(r => r.name).join(', ')}
                </span>
              )}
              {nextEvent.rooms && nextEvent.rooms.length > 0 && <span>•</span>}
              <span>{format(eventDate, 'EEE, MMM d')} at {format(eventDate, 'h:mm a')}</span>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-emerald-600 font-medium mb-1">COUNTDOWN</p>
            <div className="flex items-center gap-1">
              {days > 0 && (
                <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-700">{days}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Days</p>
                </div>
              )}
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">{String(hours).padStart(2, '0')}</p>
                <p className="text-[10px] text-slate-500 uppercase">Hrs</p>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">{String(minutes).padStart(2, '0')}</p>
                <p className="text-[10px] text-slate-500 uppercase">Min</p>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">{String(seconds).padStart(2, '0')}</p>
                <p className="text-[10px] text-slate-500 uppercase">Sec</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyDepartment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedDepts, setExpandedDepts] = useState(['it', 'facilities', 'comms', 'print_shop', 'hospitality']);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [userRole, setUserRole] = useState(null);
  const [userDepartments, setUserDepartments] = useState([]);
  const [departmentWorkers, setDepartmentWorkers] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDetails, setNewTaskDetails] = useState("");
  const [deptTasks, setDeptTasks] = useState([]);
  const [newRoutineTask, setNewRoutineTask] = useState({ title: "", description: "", frequency: "monthly", assignee: "", attachments: [], dueDate: "" });
  const [addingTask, setAddingTask] = useState(false);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [ticketSort, setTicketSort] = useState("due_date");
  const [taskSort, setTaskSort] = useState("due_date");
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRoutineTask, setSelectedRoutineTask] = useState(null);
  const [pcoEvents, setPcoEvents] = useState([]);
  const [loadingPcoEvents, setLoadingPcoEvents] = useState(false);
  const [showResolvedTickets, setShowResolvedTickets] = useState(false);
  const [showOpenTickets, setShowOpenTickets] = useState(false);
  const [showInProgressTickets, setShowInProgressTickets] = useState(false);
  const [showDeptTasks, setShowDeptTasks] = useState(false);
  const [showRoutineTasks, setShowRoutineTasks] = useState(false);

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    loadData();
    loadDeptTasks();
    loadPcoFacilitiesEvents();
  }, []);

  // Refresh dept tasks when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDeptTasks();
      }
    };
    
    const handleFocus = () => {
      loadDeptTasks();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadDeptTasks = () => {
    const storedDeptTasks = localStorage.getItem('deptTasks');
    if (storedDeptTasks) {
      try {
        const tasks = JSON.parse(storedDeptTasks);
        console.log('Loaded dept tasks:', tasks);
        setDeptTasks(tasks);
      } catch (e) {
        console.error('Error loading dept tasks:', e);
      }
    }
    
    // Also load routine tasks
    const storedRoutineTasks = localStorage.getItem('routineTasks');
    if (storedRoutineTasks) {
      try {
        const tasks = JSON.parse(storedRoutineTasks);
        console.log('Loaded routine tasks:', tasks);
        setRoutineTasks(tasks);
      } catch (e) {
        console.error('Error loading routine tasks:', e);
      }
    }
  };

  const loadPcoFacilitiesEvents = async () => {
    setLoadingPcoEvents(true);
    try {
      // Fetch events from PCO
      const response = await base44.functions.invoke('getPCOCalendarEvents');
      
      if (response.data?.events) {
        // Filter to only events with Room Setup or Maintenance resources
        const facilitiesEvents = response.data.events.filter(event => {
          const resources = event.resources || [];
          return resources.some(r => 
            r.name?.toLowerCase().includes('room setup') || 
            r.name?.toLowerCase().includes('maintenance') ||
            r.name?.toLowerCase().includes('facilities') ||
            r.category?.toLowerCase().includes('room setup') ||
            r.category?.toLowerCase().includes('maintenance') ||
            r.category?.toLowerCase().includes('facilities')
          );
        });
        setPcoEvents(facilitiesEvents);
      }
    } catch (error) {
      console.error('Error loading PCO facilities events:', error);
    } finally {
      setLoadingPcoEvents(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Fetch user's role and departments from security groups
      const rolesResponse = await base44.functions.invoke('getUsersWithTicketRoles');
      if (rolesResponse.data.success) {
        const userData = rolesResponse.data.allUsers.find(u => 
          u.user_email === currentUser.email
        );
        
        if (userData) {
          setUserRole(userData.ticket_role);
          setUserDepartments(userData.departments || []);
        }
        
        // Get workers for user's departments
        const workers = rolesResponse.data.allUsers.filter(u => 
          u.ticket_role === 'worker' || u.ticket_role === 'admin'
        );
        setDepartmentWorkers(workers);
      }

      // Only show operations dashboard (preview mode) for Andy or super_user
      const isOperationsManager = currentUser.email?.toLowerCase().includes('andy') || 
                                   currentUser.role === 'super_user';
      
      if (isOperationsManager) {
        setIsPreviewMode(true);
      }

      const allTickets = await base44.entities.Ticket.list('-created_date');
      setTickets(allTickets);
      
      // Get unassigned tickets
      const unassigned = allTickets.filter(t => 
        !t.assigned_to && 
        ['open', 'awaiting_information', 'awaiting_parts'].includes(t.status)
      );
      setUnassignedTickets(unassigned);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load department data');
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (source) => {
    const sourceConfig = {
      manual_request: { label: "Requested", icon: MousePointerClick, color: "blue" },
      pco_auto: { label: "PCO Auto", icon: Zap, color: "purple" },
      email: { label: "Email", icon: Mail, color: "green" },
      workflow: { label: "Workflow", icon: Workflow, color: "orange" }
    };
    const config = sourceConfig[source] || sourceConfig.manual_request;
    const Icon = config.icon;
    return { Icon, config };
  };

  const toggleDept = (dept) => {
    setExpandedDepts(prev => 
      prev.includes(dept) 
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    );
  };

  const getDepartment = (category) => {
    const deptMap = {
      'technology': 'it',
      'maintenance': 'facilities',
      'cleaning': 'facilities',
      'av_production': 'comms',
      'marketing': 'comms',
      'social_media': 'comms',
      'communications': 'comms'
    };
    return deptMap[category] || 'other';
  };

  const getEscalations = () => {
    const now = new Date();
    return tickets.filter(t => {
      if (t.status === 'resolved' || t.status === 'closed') return false;
      
      const createdDate = new Date(t.created_date);
      const hoursOpen = differenceInHours(now, createdDate);
      
      return (
        !t.assigned_to || 
        (t.priority === 'urgent' && hoursOpen > 2) || 
        (t.priority === 'high' && hoursOpen > 4) || 
        hoursOpen > 24
      );
    });
  };

  const getWeeklyTrends = () => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = startOfWeek(subDays(now, 7));
    const lastWeekEnd = endOfWeek(subDays(now, 7));

    const thisWeekTickets = tickets.filter(t => 
      isAfter(new Date(t.created_date), thisWeekStart)
    );

    const lastWeekTickets = tickets.filter(t => {
      const date = new Date(t.created_date);
      return isAfter(date, lastWeekStart) && isBefore(date, lastWeekEnd);
    });

    const change = thisWeekTickets.length - lastWeekTickets.length;
    const percentChange = lastWeekTickets.length > 0 
      ? ((change / lastWeekTickets.length) * 100).toFixed(1)
      : 0;

    return {
      thisWeek: thisWeekTickets.length,
      lastWeek: lastWeekTickets.length,
      change,
      percentChange,
      isIncrease: change > 0
    };
  };

  const getPerformanceMetrics = () => {
    const resolvedTickets = tickets.filter(t => 
      t.status === 'resolved' || t.status === 'closed'
    );

    const calculateAvgResolution = (deptTickets) => {
      const resolved = deptTickets.filter(t => t.resolved_at);
      if (resolved.length === 0) return null;
      
      const totalHours = resolved.reduce((sum, t) => {
        const created = new Date(t.created_date);
        const resolvedAt = new Date(t.resolved_at);
        return sum + differenceInHours(resolvedAt, created);
      }, 0);
      
      return (totalHours / resolved.length).toFixed(1);
    };

    return {
      it: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'it')),
      facilities: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'facilities')),
      comms: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'comms')),
      print_shop: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'print_shop')),
      hospitality: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'hospitality'))
    };
  };

  const getHotSpots = () => {
    const buildingCounts = {};
    tickets.forEach(t => {
      if (t.building) {
        buildingCounts[t.building] = (buildingCounts[t.building] || 0) + 1;
      }
    });

    return Object.entries(buildingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([building, count]) => ({
        building: building.replace(/_/g, ' '),
        count,
        openCount: tickets.filter(t => 
          t.building === building && 
          (t.status === 'open' || t.status === 'in_progress')
        ).length
      }));
  };

  const getTicketsByStatus = () => {
    const statusData = {};
    // Only count open statuses (not resolved/closed/archived)
    const openStatuses = ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'];
    filteredTickets.filter(t => openStatuses.includes(t.status)).forEach(t => {
      const status = t.status || 'open';
      statusData[status] = (statusData[status] || 0) + 1;
    });
    
    const colors = {
      open: '#3b82f6',
      in_progress: '#8b5cf6',
      awaiting_information: '#f59e0b',
      awaiting_parts: '#f97316'
    };
    
    return Object.entries(statusData).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value,
      color: colors[name] || colors.open
    }));
  };

  const getMonthlyActivityByDept = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));
      months.push({
        month: format(monthStart, 'MMM'),
        start: monthStart,
        end: monthEnd
      });
    }
    
    return months.map(({ month, start, end }) => {
      // Count resolved tickets
      const monthTickets = tickets.filter(t => {
        if (!t.resolved_at) return false;
        const resolvedDate = new Date(t.resolved_at);
        return isAfter(resolvedDate, start) && isBefore(resolvedDate, end);
      });
      
      // Count completed dept tasks
      const completedDeptTasks = deptTasks.filter(t => {
        if (!t.completed) return false;
        const completedDate = t.completedAt ? new Date(t.completedAt) : null;
        if (!completedDate) return false;
        return isAfter(completedDate, start) && isBefore(completedDate, end);
      });
      
      // Count completed routine tasks (by lastCompletedAt)
      const completedRoutineTasks = routineTasks.filter(t => {
        if (!t.lastCompletedAt) return false;
        const completedDate = new Date(t.lastCompletedAt);
        return isAfter(completedDate, start) && isBefore(completedDate, end);
      });
      
      return {
        month,
        Tickets: monthTickets.length,
        'Dept Tasks': completedDeptTasks.length,
        'Routine Tasks': completedRoutineTasks.length
      };
    });
  };

  const getRecurringIssues = () => {
    const issueMap = {};
    
    tickets.forEach(t => {
      const key = `${t.building}-${t.room_number}-${t.category}`;
      if (!issueMap[key]) {
        issueMap[key] = {
          building: t.building,
          room: t.room_number,
          category: t.category,
          count: 0,
          tickets: []
        };
      }
      issueMap[key].count++;
      issueMap[key].tickets.push(t);
    });

    return Object.values(issueMap)
      .filter(issue => issue.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getCrossDepartmentTickets = () => {
    return tickets.filter(t => {
      const tags = t.tags || [];
      const description = (t.description || '').toLowerCase();
      
      return tags.includes('multi-department') ||
             description.includes('it') && description.includes('facilities') ||
             description.includes('av') && description.includes('setup');
    });
  };

  const getActivityFeed = () => {
    const activities = [];
    
    tickets.slice(0, 50).forEach(ticket => {
      activities.push({
        type: 'created',
        ticket,
        timestamp: new Date(ticket.created_date),
        message: `${ticket.requester_name || 'Someone'} created ticket`,
        user: ticket.requester_name
      });

      if (ticket.assigned_to) {
        activities.push({
          type: 'assigned',
          ticket,
          timestamp: new Date(ticket.updated_date || ticket.created_date),
          message: `Assigned to ${ticket.assigned_to_name || ticket.assigned_to}`,
          user: 'System'
        });
      }

      if (ticket.status === 'resolved' && ticket.resolved_at) {
        activities.push({
          type: 'resolved',
          ticket,
          timestamp: new Date(ticket.resolved_at),
          message: `Marked as resolved`,
          user: ticket.assigned_to_name || 'Staff'
        });
      }

      if (ticket.comments && ticket.comments.length > 0) {
        ticket.comments.forEach(comment => {
          activities.push({
            type: 'comment',
            ticket,
            timestamp: new Date(comment.timestamp),
            message: `Commented on ticket`,
            user: comment.author_name,
            comment: comment.content
          });
        });
      }
    });

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesSource = sourceFilter === "all" || ticket.source === sourceFilter;
    
    // Filter based on user role - show ALL department tickets
    const ticketDept = getDepartment(ticket.category);
    const isInUserDept = userDepartments.some(dept => 
      ticketDept === dept.toLowerCase().replace(' ', '_') ||
      ticketDept === dept.toLowerCase()
    );
    
    if (userRole === 'requester') {
      // Requesters see all tickets in their department
      return matchesStatus && matchesPriority && matchesSource && isInUserDept;
    } else if (userRole === 'worker') {
      // Workers see all tickets in their department
      return matchesStatus && matchesPriority && matchesSource && isInUserDept;
    } else if (userRole === 'admin') {
      // Admins see everything in their departments
      return matchesStatus && matchesPriority && matchesSource && isInUserDept;
    }
    
    // Default (operations manager, etc.)
    return matchesStatus && matchesPriority && matchesSource;
  });

  const ticketsByDept = {
    it: filteredTickets.filter(t => getDepartment(t.category) === 'it'),
    facilities: filteredTickets.filter(t => getDepartment(t.category) === 'facilities'),
    comms: filteredTickets.filter(t => getDepartment(t.category) === 'comms'),
    print_shop: filteredTickets.filter(t => getDepartment(t.category) === 'print_shop'),
    hospitality: filteredTickets.filter(t => getDepartment(t.category) === 'hospitality'),
    other: filteredTickets.filter(t => getDepartment(t.category) === 'other')
  };

  const getDeptStats = (deptTickets) => ({
    total: deptTickets.length,
    open: deptTickets.filter(t => t.status === 'open').length,
    in_progress: deptTickets.filter(t => t.status === 'in_progress').length,
    urgent: deptTickets.filter(t => t.priority === 'urgent').length,
    manual: deptTickets.filter(t => t.source === 'manual_request').length,
    auto: deptTickets.filter(t => ['pco_auto', 'email', 'workflow'].includes(t.source)).length
  });

  const departments = [
    {
      id: 'it',
      name: 'IT',
      manager: 'Billy Nelms',
      icon: '💻',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'facilities',
      name: 'Facilities',
      manager: 'Kenny Bentley',
      icon: '🔧',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'comms',
      name: 'Communications',
      manager: 'Kyle Judkins',
      icon: '📢',
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      id: 'print_shop',
      name: 'Print Shop',
      manager: 'Merrick Steele',
      icon: '🖨️',
      color: 'from-indigo-500 to-blue-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      futureApp: true
    },
    {
      id: 'hospitality',
      name: 'Hospitality',
      manager: 'Erica Salyer',
      icon: '☕',
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      futureApp: true
    }
  ];

  const escalations = getEscalations();
  const weeklyTrends = getWeeklyTrends();
  const performanceMetrics = getPerformanceMetrics();
  const hotSpots = getHotSpots();
  const recurringIssues = getRecurringIssues();
  const crossDeptTickets = getCrossDepartmentTickets();
  const activityFeed = getActivityFeed();
  const statusData = getTicketsByStatus();
  const monthlyActivityData = getMonthlyActivityByDept();

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || sourceFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSourceFilter("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-violet-50 to-purple-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-violet-600" />
                {userRole === 'admin' ? 'Department Admin' : 
                 userRole === 'worker' ? 'My Department' :
                 userRole === 'requester' ? 'My Department' :
                 'Operations Dashboard'}
                {(user?.role === 'admin' || user?.role === 'super_user') && (
                  <Crown className={`w-5 h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                )}
              </h1>
              <p className="text-sm text-slate-600">
                {userRole === 'admin' ? `Department Management • ${userDepartments.join(', ')}` :
                 userRole === 'worker' ? `Worker • ${userDepartments.join(', ')}` :
                 userRole === 'requester' ? `Team Member • ${userDepartments.join(', ')}` :
                 'Command center for Operations Manager'}
              </p>
            </div>
          </div>
          {/* Show/Hide All Button */}
          {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allOpen = showDeptTasks && showRoutineTasks && showOpenTickets && showInProgressTickets && showResolvedTickets;
                if (allOpen) {
                  // Hide all
                  setShowDeptTasks(false);
                  setShowRoutineTasks(false);
                  setShowOpenTickets(false);
                  setShowInProgressTickets(false);
                  setShowResolvedTickets(false);
                } else {
                  // Show all
                  setShowDeptTasks(true);
                  setShowRoutineTasks(true);
                  setShowOpenTickets(true);
                  setShowInProgressTickets(true);
                  setShowResolvedTickets(true);
                }
              }}
              className="flex items-center gap-1"
            >
              {(showDeptTasks && showRoutineTasks && showOpenTickets && showInProgressTickets && showResolvedTickets) ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Hide All</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Show All</span>
                </>
              )}
            </Button>
          )}
        </div>

        {!userRole && (
          <Card className="mb-6 border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900">No Department Access</p>
                  <p className="text-sm text-blue-700">
                    You're not currently assigned to any security groups. Contact IT to get access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isPreviewMode && (
          <Card className="mb-6 border-2 border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900">Preview Mode</p>
                  <p className="text-sm text-amber-700">
                    This is Andy Milliorn's Operations Dashboard with real-time insights, performance metrics, and escalation alerts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${
            userDepartments.some(d => d.toLowerCase() === 'facilities') 
              ? (!isPreviewMode ? 'grid-cols-3' : 'grid-cols-4')
              : (!isPreviewMode ? 'grid-cols-2' : 'grid-cols-3')
          }`}>
            <TabsTrigger value="overview">
              {userRole === 'requester' || userRole === 'worker' ? (
                <>
                  <Ticket className="w-4 h-4 mr-2" />
                  My Tickets
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Overview
                </>
              )}
            </TabsTrigger>
            <TabsTrigger value="department">
              <Building2 className="w-4 h-4 mr-2" />
              Department Info
            </TabsTrigger>
            {userDepartments.some(d => d.toLowerCase() === 'facilities') && (
              <TabsTrigger value="roomflow">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Room Flow
              </TabsTrigger>
            )}
            {isPreviewMode && (
              <TabsTrigger value="insights">
                <Target className="w-4 h-4 mr-2" />
                Insights
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Charts Section - Pie Chart and Monthly Tracker */}
            {(isPreviewMode || userRole === 'admin') && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Pie Chart - Tickets by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-4 h-4 text-violet-600" />
                      Tickets by Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value, name) => [value, 'Tickets']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-slate-500">
                        No ticket data available
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      {statusData.map((item, index) => (
                        <div key={index} className="flex items-center gap-1 text-xs">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Tracker - Tickets Closed by Dept (Line Chart) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="w-4 h-4 text-violet-600" />
                      Monthly Tickets Closed by Dept
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyClosedData}>
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line type="monotone" dataKey="IT" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                          <Line type="monotone" dataKey="Facilities" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                          <Line type="monotone" dataKey="Communications" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span>IT</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-emerald-500" />
                        <span>Facilities</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-violet-500" />
                        <span>Communications</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Stats Row - Tasks & Routine */}
            {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowDeptTasks(!showDeptTasks)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs sm:text-sm text-slate-600">Dept Tasks</p>
                        <p className="text-xl sm:text-2xl font-bold text-teal-700">
                          {deptTasks.filter(t => !t.completed).length}
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-teal-500" />
                    </div>
                    <p className="text-xs text-slate-500">Click to view</p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowRoutineTasks(!showRoutineTasks)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs sm:text-sm text-slate-600">Routine Tasks</p>
                        <p className="text-xl sm:text-2xl font-bold text-indigo-700">
                          {routineTasks.length}
                        </p>
                      </div>
                      <RepeatIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
                    </div>
                    <p className="text-xs text-slate-500">Click to view</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Dept Tasks - Collapsible Section */}
            {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <AnimatePresence>
                {showDeptTasks && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-teal-800">
                            <div className="p-2 bg-teal-100 rounded-lg">
                              <CheckCircle2 className="w-5 h-5 text-teal-600" />
                            </div>
                            Dept Tasks
                            <Badge className="bg-teal-100 text-teal-700 border-teal-300 ml-2">
                              {deptTasks.filter(t => !t.completed).length} active
                            </Badge>
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Select value={taskSort} onValueChange={setTaskSort}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue placeholder="Sort..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="due_date">Due Date</SelectItem>
                                <SelectItem value="assignee">Assignee</SelectItem>
                                <SelectItem value="created">Created</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowDeptTasks(false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {deptTasks
                            .filter(t => !t.completed)
                            .sort((a, b) => {
                              if (taskSort === 'due_date') {
                                return new Date(a.dueDate) - new Date(b.dueDate);
                              } else if (taskSort === 'assignee') {
                                return (a.assigneeName || '').localeCompare(b.assigneeName || '');
                              } else {
                                return new Date(b.createdAt) - new Date(a.createdAt);
                              }
                            })
                            .map((task) => (
                            <div
                              key={task.id}
                              className="p-3 bg-white rounded-lg border border-teal-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedTasks = deptTasks.map(t => 
                                      t.id === task.id ? {...t, completed: !t.completed} : t
                                    );
                                    setDeptTasks(updatedTasks);
                                    localStorage.setItem('deptTasks', JSON.stringify(updatedTasks));
                                    toast.success('Task completed!');
                                  }}
                                  className="w-5 h-5 rounded-full border-2 border-teal-400 flex items-center justify-center cursor-pointer hover:bg-teal-100 transition-colors flex-shrink-0"
                                >
                                  {task.completed && <CheckCircle2 className="w-3 h-3 text-teal-600" />}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {getInitials(task.assigneeName)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 text-sm truncate">{task.title}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span>{task.assigneeName}</span>
                                    <span>•</span>
                                    <span className="text-teal-600 font-medium">Due {format(new Date(task.dueDate + 'T12:00:00'), 'MMM d')}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {deptTasks.filter(t => !t.completed).length === 0 && (
                            <p className="text-center text-slate-500 py-4 text-sm">No active tasks</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Routine Tasks - Collapsible Section */}
            {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <AnimatePresence>
                {showRoutineTasks && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-indigo-800">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                              <RepeatIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            Routine Tasks
                            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 ml-2">
                              {routineTasks.length} configured
                            </Badge>
                          </CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowRoutineTasks(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {routineTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-3 bg-white rounded-lg border border-indigo-200 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => setSelectedRoutineTask(task)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <RepeatIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {getInitials(task.assigneeName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 text-sm truncate">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                      <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-300">
                                        {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                                      </Badge>
                                      <span>{task.assigneeName || 'Unassigned'}</span>
                                      {task.nextDueDate && (
                                        <span className="text-indigo-600 font-medium">Due {format(new Date(task.nextDueDate + 'T12:00:00'), 'MMM d')}</span>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Attachments Section */}
                              <div className="mt-2 pt-2 border-t border-indigo-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(task.attachments || []).map((attachment, idx) => (
                                    <a
                                      key={idx}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100"
                                    >
                                      <Folder className="w-3 h-3" />
                                      {attachment.name || `File ${idx + 1}`}
                                    </a>
                                  ))}
                                  <label className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-200 cursor-pointer">
                                    <Plus className="w-3 h-3" />
                                    Add File
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                          const updatedRoutineTasks = routineTasks.map(t => {
                                            if (t.id === task.id) {
                                              return {
                                                ...t,
                                                attachments: [...(t.attachments || []), { name: file.name, url: file_url }]
                                              };
                                            }
                                            return t;
                                          });
                                          setRoutineTasks(updatedRoutineTasks);
                                          localStorage.setItem('routineTasks', JSON.stringify(updatedRoutineTasks));
                                          toast.success('File attached');
                                        } catch (error) {
                                          toast.error('Failed to upload file');
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                          {routineTasks.length === 0 && (
                            <p className="text-center text-slate-500 py-4 text-sm">No routine tasks configured</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Ticket Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {userRole === 'requester' ? 'My Tickets' : 
                         userRole === 'worker' ? 'My Tickets' : 
                         'Total Tickets'}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredTickets.length}</p>
                    </div>
                    <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-violet-500" />
                  </div>
                  {userRole === 'worker' && (
                    <p className="text-xs text-slate-500">
                      {filteredTickets.filter(t => t.assigned_to === user?.email).length} assigned to me
                    </p>
                  )}
                  {!userRole && (
                    <div className="flex items-center gap-1 text-xs">
                      {weeklyTrends.isIncrease ? (
                        <TrendingUp className="w-3 h-3 text-red-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-green-500" />
                      )}
                      <span className={weeklyTrends.isIncrease ? 'text-red-600' : 'text-green-600'}>
                        {Math.abs(weeklyTrends.percentChange)}%
                      </span>
                      <span className="text-slate-500">vs last week</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card 
                className={`${(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                onClick={() => {
                  if ((userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode) {
                    setShowOpenTickets(!showOpenTickets);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">Open</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-700">
                        {filteredTickets.filter(t => t.status === 'open').length}
                      </p>
                    </div>
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'Click to view' :
                     `${filteredTickets.filter(t => t.status === 'open' && !t.assigned_to).length} unassigned`}
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`${(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                onClick={() => {
                  if ((userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode) {
                    setShowInProgressTickets(!showInProgressTickets);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {(userRole === 'worker' || userRole === 'admin' || userRole === 'requester') && !isPreviewMode ? 'Awaiting' : 'Escalations'}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-700">
                        {(userRole === 'worker' || userRole === 'admin' || userRole === 'requester') && !isPreviewMode ? 
                          filteredTickets.filter(t => ['in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length :
                          escalations.length}
                      </p>
                    </div>
                    <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'Click to view' : 'Needs immediate attention'}
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`${(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                onClick={() => {
                  if ((userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode) {
                    setShowResolvedTickets(!showResolvedTickets);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'Resolved' : 'Cross-Dept'}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-green-700">
                        {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ?
                          filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length :
                          crossDeptTickets.length}
                      </p>
                    </div>
                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode ? 'Click to view' : 'Coordination needed'}
                  </p>
                </CardContent>
              </Card>
              </div>

              {/* Open Tickets - Collapsible Section */}
              {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <AnimatePresence>
                {showOpenTickets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-blue-800">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            Open Tickets
                            <Badge className="bg-blue-100 text-blue-700 border-blue-300 ml-2">
                              {filteredTickets.filter(t => t.status === 'open').length}
                            </Badge>
                          </CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowOpenTickets(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredTickets
                            .filter(t => t.status === 'open')
                            .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                            .slice(0, 15)
                            .map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-3 bg-white rounded-lg border border-blue-200 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                                  ticket.assigned_to_name ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-slate-300'
                                }`}>
                                  {ticket.assigned_to_name ? getInitials(ticket.assigned_to_name) : '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 text-sm truncate">{ticket.subject}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span>{ticket.ticket_number}</span>
                                    <span>•</span>
                                    <span>Created {format(new Date(ticket.created_date), 'MMM d')}</span>
                                    <Badge className={`text-xs ${
                                      ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                      ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {ticket.priority}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredTickets.filter(t => t.status === 'open').length === 0 && (
                            <p className="text-center text-slate-500 py-4 text-sm">No open tickets</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              )}

              {/* In Progress Tickets - Collapsible Section */}
              {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <AnimatePresence>
                {showInProgressTickets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-purple-800">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Flame className="w-5 h-5 text-purple-600" />
                            </div>
                            Awaiting Tickets
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300 ml-2">
                              {filteredTickets.filter(t => ['in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length}
                            </Badge>
                          </CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowInProgressTickets(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredTickets
                            .filter(t => ['in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status))
                            .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
                            .slice(0, 15)
                            .map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-3 bg-white rounded-lg border border-purple-200 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {getInitials(ticket.assigned_to_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 text-sm truncate">{ticket.subject}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span>{ticket.ticket_number}</span>
                                    {ticket.assigned_to_name && (
                                      <>
                                        <span>•</span>
                                        <span>{ticket.assigned_to_name}</span>
                                      </>
                                    )}
                                    <Badge className={`text-xs ${
                                      ticket.status === 'awaiting_information' ? 'bg-yellow-100 text-yellow-700' :
                                      ticket.status === 'awaiting_parts' ? 'bg-orange-100 text-orange-700' :
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {ticket.status === 'awaiting_information' ? 'Awaiting Info' :
                                       ticket.status === 'awaiting_parts' ? 'Awaiting Parts' : 'In Progress'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredTickets.filter(t => ['in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length === 0 && (
                            <p className="text-center text-slate-500 py-4 text-sm">No awaiting tickets</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              )}

              {/* Resolved Tickets - Collapsible Section */}
              {(userRole === 'requester' || userRole === 'worker' || userRole === 'admin') && !isPreviewMode && (
              <AnimatePresence>
                {showResolvedTickets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-green-800">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            Resolved Tickets
                            <Badge className="bg-green-100 text-green-700 border-green-300 ml-2">
                              {filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length}
                            </Badge>
                          </CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowResolvedTickets(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredTickets
                            .filter(t => ['resolved', 'closed'].includes(t.status))
                            .sort((a, b) => new Date(b.resolved_at || b.updated_date) - new Date(a.resolved_at || a.updated_date))
                            .slice(0, 15)
                            .map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-3 bg-white rounded-lg border border-green-200 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {getInitials(ticket.assigned_to_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 text-sm truncate">{ticket.subject}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span>{ticket.ticket_number}</span>
                                    {ticket.resolved_at && (
                                      <>
                                        <span>•</span>
                                        <span>Resolved {format(new Date(ticket.resolved_at), 'MMM d')}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length === 0 && (
                            <p className="text-center text-slate-500 py-4 text-sm">No resolved tickets</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              )}



            {isPreviewMode && escalations.length > 0 && (
              <Card className="border-2 border-red-300 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-900">
                    <AlertCircle className="w-5 h-5" />
                    🚨 Escalation Alerts ({escalations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {escalations.slice(0, 5).map((ticket) => {
                      const hoursOpen = differenceInHours(new Date(), new Date(ticket.created_date));
                      return (
                        <div
                          key={ticket.id}
                          className="p-3 bg-white rounded-lg border-2 border-red-200 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900 text-sm">{ticket.subject}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                                <span>{ticket.ticket_number}</span>
                                <span>•</span>
                                <Clock className="w-3 h-3" />
                                <span className="text-red-600 font-semibold">{hoursOpen}hrs open</span>
                                {!ticket.assigned_to && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                      Unassigned
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge className="bg-red-100 text-red-700 border-red-300">
                              {ticket.priority}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {isPreviewMode && (
            <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-600" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-4">
                  {departments.map((dept) => {
                    const avgTime = performanceMetrics[dept.id];
                    const status = !avgTime ? 'gray' : avgTime < 3 ? 'green' : avgTime < 6 ? 'yellow' : 'red';
                    return (
                      <div key={dept.id} className={`p-4 rounded-lg ${dept.bgColor} border ${dept.borderColor}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{dept.icon}</span>
                            <p className="font-semibold text-slate-900 text-sm">{dept.name}</p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${
                            status === 'green' ? 'bg-green-500' :
                            status === 'yellow' ? 'bg-yellow-500' :
                            status === 'red' ? 'bg-red-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="text-2xl font-bold text-slate-900">
                          {avgTime ? `${avgTime}hrs` : 'N/A'}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">Avg. resolution</p>
                        {dept.futureApp && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Future App
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Filter className="w-5 h-5" />
                    Filters
                  </CardTitle>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="manual_request">Requested</SelectItem>
                      <SelectItem value="pco_auto">PCO Auto</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {departments.map((dept) => {
                const deptTickets = ticketsByDept[dept.id];
                const stats = getDeptStats(deptTickets);
                const isExpanded = expandedDepts.includes(dept.id);

                return (
                  <Card key={dept.id} className={`border-2 ${dept.borderColor} ${dept.bgColor}`}>
                    <CardHeader 
                      className="cursor-pointer hover:bg-white/50 transition-colors"
                      onClick={() => toggleDept(dept.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 bg-gradient-to-br ${dept.color} rounded-xl shadow-lg text-2xl`}>
                            {dept.icon}
                          </div>
                          <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                              {dept.name}
                              {dept.futureApp && (
                                <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                              )}
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </CardTitle>
                            <p className="text-sm text-slate-600">Manager: {dept.manager}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                            <p className="text-xs text-slate-600">Total</p>
                          </div>
                          {stats.urgent > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-red-300">
                              {stats.urgent} Urgent
                            </Badge>
                          )}
                          {stats.open > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                              {stats.open} Open
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CardContent className="pt-0">
                            <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-white rounded-lg">
                              <div className="text-center">
                                <p className="text-lg font-bold text-blue-600">{stats.open}</p>
                                <p className="text-xs text-slate-600">Open</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-purple-600">{stats.in_progress}</p>
                                <p className="text-xs text-slate-600">In Progress</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-blue-600">{stats.manual}</p>
                                <p className="text-xs text-slate-600">Requested</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-purple-600">{stats.auto}</p>
                                <p className="text-xs text-slate-600">Auto</p>
                              </div>
                            </div>

                            {deptTickets.length > 0 ? (
                              <div className="space-y-2">
                                {deptTickets.slice(0, 5).map((ticket) => {
                                  const { Icon, config } = getSourceBadge(ticket.source || 'manual_request');
                                  return (
                                    <div
                                      key={ticket.id}
                                      className="p-3 bg-white rounded-lg border hover:shadow-md transition-all cursor-pointer"
                                      onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-slate-900 text-sm truncate">
                                            {ticket.subject}
                                          </p>
                                          <p className="text-xs text-slate-600 mt-1">
                                            {ticket.ticket_number} • {format(new Date(ticket.created_date), 'MMM d')}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <Badge variant="outline" className={`text-xs ${
                                            config.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                            config.color === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                                            config.color === 'green' ? 'bg-green-50 text-green-700 border-green-300' :
                                            'bg-orange-50 text-orange-700 border-orange-300'
                                          }`}>
                                            <Icon className="w-3 h-3 mr-1" />
                                            {config.label}
                                          </Badge>
                                          <Badge className={`text-xs ${
                                            ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                            ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                            ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-100 text-blue-700'
                                          }`}>
                                            {ticket.priority}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {deptTickets.length > 5 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => navigate(createPageUrl('SupportTickets'))}
                                  >
                                    View all {deptTickets.length} tickets
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-slate-500 mb-2">
                                  {dept.futureApp ? 'App launching soon!' : 'No tickets found'}
                                </p>
                                {dept.futureApp && (
                                  <p className="text-xs text-slate-400">
                                    Metrics will appear when the app goes live
                                  </p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="department" className="space-y-6">
            {/* Only show management features for workers and admins */}
            {(userRole === 'worker' || userRole === 'admin' || isPreviewMode) ? (
              <>
                {/* Unassigned Tickets - Drag and Drop */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-orange-600" />
                      Tickets Needing Assignment ({unassignedTickets.filter(t => {
                        const ticketDept = getDepartment(t.category);
                        return userDepartments.some(d => ticketDept === d.toLowerCase().replace(' ', '_')) || isPreviewMode;
                      }).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid lg:grid-cols-2 gap-4">
                      {/* Unassigned Tickets List */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-600 mb-2">Drag to assign:</p>
                        {unassignedTickets.filter(t => {
                          const ticketDept = getDepartment(t.category);
                          return userDepartments.some(d => ticketDept === d.toLowerCase().replace(' ', '_')) || isPreviewMode;
                        }).length > 0 ? (
                          unassignedTickets.filter(t => {
                            const ticketDept = getDepartment(t.category);
                            return userDepartments.some(d => ticketDept === d.toLowerCase().replace(' ', '_')) || isPreviewMode;
                          }).map((ticket) => (
                            <div
                              key={ticket.id}
                              draggable
                              onDragStart={() => setDraggedTicket(ticket)}
                              onDragEnd={() => setDraggedTicket(null)}
                              className="p-3 bg-orange-50 rounded-lg border border-orange-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-start gap-2"
                            >
                              <GripVertical className="w-4 h-4 text-orange-400 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 text-sm truncate">{ticket.subject}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                                  <span>{ticket.ticket_number}</span>
                                  <Badge className={`text-xs ${
                                    ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                    ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {ticket.priority}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {ticket.category?.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-slate-500 py-4 text-sm">
                            No unassigned tickets
                          </p>
                        )}
                      </div>

                      {/* Workers Drop Zones */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-600 mb-2">Drop on worker to assign:</p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {departmentWorkers.filter(w => {
                            // Filter workers by department
                            const workerDepts = w.departments || [];
                            return userDepartments.some(d => workerDepts.includes(d)) || isPreviewMode;
                          }).map((worker) => (
                            <div
                              key={worker.user_email}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={async (e) => {
                                e.preventDefault();
                                if (draggedTicket) {
                                  try {
                                    await base44.entities.Ticket.update(draggedTicket.id, {
                                      assigned_to: worker.user_email,
                                      assigned_to_name: worker.user_name || worker.user_email,
                                      last_activity_at: new Date().toISOString()
                                    });
                                    toast.success(`Assigned to ${worker.user_name || worker.user_email}`);
                                    setUnassignedTickets(prev => prev.filter(t => t.id !== draggedTicket.id));
                                    setDraggedTicket(null);
                                  } catch (error) {
                                    toast.error('Failed to assign ticket');
                                  }
                                }
                              }}
                              className={`p-3 rounded-lg border-2 border-dashed transition-all ${
                                draggedTicket 
                                  ? 'border-violet-400 bg-violet-50' 
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                                  {(worker.user_name || worker.user_email)?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">{worker.user_name || worker.user_email}</p>
                                  <p className="text-xs text-slate-500">{worker.departments?.join(', ')}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Add Task */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-green-600" />
                      Quick Add Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                          placeholder="Task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="date"
                          value={newTaskDueDate}
                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                          className="w-full sm:w-40"
                        />
                        <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {departmentWorkers.filter(w => {
                              const workerDepts = w.departments || [];
                              return userDepartments.some(d => workerDepts.includes(d)) || isPreviewMode;
                            }).map((worker) => (
                              <SelectItem key={worker.user_email} value={worker.user_email}>
                                {worker.user_name || worker.user_email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-3">
                        <Input
                          placeholder="Details - what needs to be done..."
                          value={newTaskDetails}
                          onChange={(e) => setNewTaskDetails(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                        onClick={async () => {
                          if (!newTaskTitle.trim() || !newTaskAssignee) {
                            toast.error('Please enter a task and select an assignee');
                            return;
                          }
                          setAddingTask(true);
                          try {
                            const worker = departmentWorkers.find(w => w.user_email === newTaskAssignee);
                            const newTask = {
                              id: Date.now().toString(),
                              title: newTaskTitle,
                              details: newTaskDetails,
                              assignee: newTaskAssignee,
                              assigneeName: worker?.user_name || newTaskAssignee,
                              dueDate: newTaskDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                              completed: false,
                              createdBy: user?.full_name || user?.email,
                              createdAt: new Date().toISOString()
                            };
                            const updatedTasks = [...deptTasks, newTask];
                            setDeptTasks(updatedTasks);
                            localStorage.setItem('deptTasks', JSON.stringify(updatedTasks));
                            toast.success('Task created!');
                            setNewTaskTitle("");
                            setNewTaskAssignee("");
                            setNewTaskDueDate("");
                            setNewTaskDetails("");
                            setAddingTask(false);
                          } catch (error) {
                            toast.error('Failed to create task');
                            setAddingTask(false);
                          }
                        }}
                        disabled={addingTask || !newTaskTitle.trim() || !newTaskAssignee}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly / Routine Tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-blue-600" />
                      Monthly & Routine Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Add Routine Task Form */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-slate-700 mb-3">Add Routine Task</p>
                        <div className="grid sm:grid-cols-5 gap-3">
                          <Input
                            placeholder="Task title..."
                            value={newRoutineTask.title}
                            onChange={(e) => setNewRoutineTask({...newRoutineTask, title: e.target.value})}
                            className="sm:col-span-2"
                          />
                          <Select 
                            value={newRoutineTask.frequency} 
                            onValueChange={(v) => setNewRoutineTask({...newRoutineTask, frequency: v})}
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
                          <Input
                            type="date"
                            value={newRoutineTask.dueDate}
                            onChange={(e) => setNewRoutineTask({...newRoutineTask, dueDate: e.target.value})}
                            placeholder="First due date"
                          />
                          <Select 
                            value={newRoutineTask.assignee} 
                            onValueChange={(v) => setNewRoutineTask({...newRoutineTask, assignee: v})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Assign to (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>Unassigned</SelectItem>
                              {departmentWorkers.filter(w => {
                                const workerDepts = w.departments || [];
                                return userDepartments.some(d => workerDepts.includes(d)) || isPreviewMode;
                              }).map((worker) => (
                                <SelectItem key={worker.user_email} value={worker.user_email}>
                                  {worker.user_name || worker.user_email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mt-3">
                          <Input
                            placeholder="Description (optional)..."
                            value={newRoutineTask.description}
                            onChange={(e) => setNewRoutineTask({...newRoutineTask, description: e.target.value})}
                          />
                        </div>
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          {(newRoutineTask.attachments || []).map((attachment, idx) => (
                            <div key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {attachment.name}
                              <button 
                                onClick={() => setNewRoutineTask({
                                  ...newRoutineTask, 
                                  attachments: newRoutineTask.attachments.filter((_, i) => i !== idx)
                                })}
                                className="ml-1 hover:text-blue-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <label className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-200 cursor-pointer">
                            <Plus className="w-3 h-3" />
                            Attach File
                            <input
                              type="file"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                  setNewRoutineTask({
                                    ...newRoutineTask,
                                    attachments: [...(newRoutineTask.attachments || []), { name: file.name, url: file_url }]
                                  });
                                  toast.success('File attached');
                                } catch (error) {
                                  toast.error('Failed to upload file');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <Button
                          onClick={() => {
                            if (!newRoutineTask.title.trim()) {
                              toast.error('Please enter a task title');
                              return;
                            }
                            if (!newRoutineTask.dueDate) {
                              toast.error('Please select a due date');
                              return;
                            }
                            const newTask = { 
                              ...newRoutineTask, 
                              id: Date.now(),
                              assigneeName: newRoutineTask.assignee ? (departmentWorkers.find(w => w.user_email === newRoutineTask.assignee)?.user_name || newRoutineTask.assignee) : 'Unassigned',
                              nextDueDate: newRoutineTask.dueDate,
                              type: 'routine'
                            };
                            const updatedRoutineTasks = [...routineTasks, newTask];
                            setRoutineTasks(updatedRoutineTasks);
                            localStorage.setItem('routineTasks', JSON.stringify(updatedRoutineTasks));
                            setNewRoutineTask({ title: "", description: "", frequency: "monthly", assignee: "", attachments: [], dueDate: "" });
                            toast.success('Routine task added!');
                          }}
                          size="sm"
                          className="mt-3 bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Routine Task
                        </Button>
                      </div>

                      {/* Routine Tasks List */}
                      {routineTasks.length > 0 ? (
                        <div className="space-y-2">
                          {routineTasks.map((task) => (
                            <div key={task.id} className="p-3 bg-white rounded-lg border flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <RepeatIcon className="w-4 h-4 text-blue-500" />
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">{task.title}</p>
                                  <p className="text-xs text-slate-500">
                                    {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)} • {task.assigneeName || 'Unassigned'}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const updatedTasks = routineTasks.filter(t => t.id !== task.id);
                                  setRoutineTasks(updatedTasks);
                                  localStorage.setItem('routineTasks', JSON.stringify(updatedTasks));
                                }}
                              >
                                <X className="w-4 h-4 text-slate-400" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-slate-500 py-4 text-sm">
                          No routine tasks configured yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Department Resources */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-violet-600" />
                      Department Resources
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {userDepartments.length > 0 ? (
                        userDepartments.map((dept, index) => (
                          <div key={index} className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                            <h3 className="font-semibold text-slate-900 mb-2">{dept}</h3>
                            <p className="text-sm text-slate-600 mb-3">
                              Team members: {departmentWorkers.filter(w => w.departments?.includes(dept)).length}
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                Team Directory
                              </Button>
                              <Button size="sm" variant="outline">
                                Resources
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-slate-500 py-8">
                          No department assigned yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    Department management features are only available to workers and admins.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {userDepartments.some(d => d.toLowerCase() === 'facilities') && (
            <TabsContent value="roomflow" className="space-y-6">
              {loadingPcoEvents ? (
                <Card className="border-2 border-slate-200 bg-white">
                  <CardContent className="p-6 text-center">
                    <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-spin" />
                    <p className="text-slate-500">Loading PCO events...</p>
                  </CardContent>
                </Card>
              ) : (
                <RoomFlowCountdown pcoEvents={pcoEvents} />
              )}
              
              <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-8 text-center">
                  <LayoutGrid className="w-12 h-12 text-green-300 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">More Room Flow Features</h3>
                  <p className="text-slate-600 mb-4">
                    Room setup management and coordination tools coming soon.
                  </p>
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isPreviewMode && (
          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600" />
                  Hot Spots - Building Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hotSpots.length > 0 ? (
                  <div className="space-y-3">
                    {hotSpots.map((spot, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-red-100 text-red-700' :
                            index === 1 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 capitalize">{spot.building}</p>
                            <p className="text-xs text-slate-600">{spot.openCount} open issues</p>
                          </div>
                        </div>
                        <Badge className="bg-slate-100 text-slate-700">
                          {spot.count} total tickets
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No hot spots identified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RepeatIcon className="w-5 h-5 text-orange-600" />
                  Recurring Issues - Pattern Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recurringIssues.length > 0 ? (
                  <div className="space-y-3">
                    {recurringIssues.map((issue, index) => (
                      <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 capitalize">
                              {issue.building?.replace(/_/g, ' ')} {issue.room && `- ${issue.room}`}
                            </p>
                            <p className="text-sm text-slate-600 capitalize">
                              {issue.category?.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                            {issue.count} occurrences
                          </Badge>
                        </div>
                        <p className="text-xs text-orange-700 mt-2">
                          ⚠️ Consider creating a preventive maintenance plan
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No recurring patterns detected</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                  Cross-Department Coordination
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crossDeptTickets.length > 0 ? (
                  <div className="space-y-2">
                    {crossDeptTickets.slice(0, 10).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3 bg-purple-50 rounded-lg border border-purple-200 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">{ticket.subject}</p>
                            <p className="text-xs text-slate-600 mt-1">
                              {ticket.ticket_number} • Requires multiple departments
                            </p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                            Multi-dept
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No cross-department tickets</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>

        {/* Routine Task Detail Modal */}
        <RoutineTaskDetailModal
          task={selectedRoutineTask}
          isOpen={!!selectedRoutineTask}
          onClose={() => setSelectedRoutineTask(null)}
          workers={departmentWorkers}
          onUpdate={(updatedTask) => {
            const updatedTasks = routineTasks.map(t => 
              t.id === updatedTask.id ? updatedTask : t
            );
            setRoutineTasks(updatedTasks);
            localStorage.setItem('routineTasks', JSON.stringify(updatedTasks));
            setSelectedRoutineTask(null);
          }}
          onDelete={(taskId) => {
            const updatedTasks = routineTasks.filter(t => t.id !== taskId);
            setRoutineTasks(updatedTasks);
            localStorage.setItem('routineTasks', JSON.stringify(updatedTasks));
          }}
        />

        {/* Dept Task Detail Modal */}
        <DeptTaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          workers={departmentWorkers}
          onUpdate={(updatedTask) => {
            const updatedTasks = deptTasks.map(t => 
              t.id === updatedTask.id ? updatedTask : t
            );
            setDeptTasks(updatedTasks);
            localStorage.setItem('deptTasks', JSON.stringify(updatedTasks));
            setSelectedTask(null);
          }}
          onDelete={(taskId) => {
            const updatedTasks = deptTasks.filter(t => t.id !== taskId);
            setDeptTasks(updatedTasks);
            localStorage.setItem('deptTasks', JSON.stringify(updatedTasks));
          }}
        />
      </div>
    </div>
  );
}