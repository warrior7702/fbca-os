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
  Flame
} from "lucide-react";
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
import { format, subDays, isAfter, isBefore, differenceInHours, startOfWeek, endOfWeek } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MyDepartment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedDepts, setExpandedDepts] = useState(['it', 'facilities', 'comms']);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const isOperationsManager = currentUser.email?.toLowerCase().includes('andy') || 
                                   currentUser.role === 'admin' || 
                                   currentUser.role === 'super_user';
      
      if (!isOperationsManager) {
        setIsPreviewMode(true);
      }

      const allTickets = await base44.entities.Ticket.list('-created_date');
      setTickets(allTickets);
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
      'technical': 'it',
      'access': 'it',
      'facility': 'facilities',
      'facility_cleaning': 'facilities',
      'av_production': 'comms',
      'marketing': 'comms',
      'graphics': 'comms',
      'social_media': 'comms',
      'communications': 'comms',
      'event_setup': 'facilities',
      'room_setup': 'facilities'
    };
    return deptMap[category] || 'other';
  };

  // Calculate escalations
  const getEscalations = () => {
    const now = new Date();
    return tickets.filter(t => {
      if (t.status === 'resolved' || t.status === 'closed') return false;
      
      const createdDate = new Date(t.created_date);
      const hoursOpen = differenceInHours(now, createdDate);
      
      return (
        !t.assigned_to || // No assignment
        (t.priority === 'urgent' && hoursOpen > 2) || // Urgent open > 2hrs
        (t.priority === 'high' && hoursOpen > 4) || // High open > 4hrs
        hoursOpen > 24 // Any open > 24hrs
      );
    });
  };

  // Calculate week over week trends
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

  // Calculate performance metrics
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
      comms: calculateAvgResolution(resolvedTickets.filter(t => getDepartment(t.category) === 'comms'))
    };
  };

  // Hot spot analysis
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

  // Recurring issues detector
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

  // Cross-department tickets
  const getCrossDepartmentTickets = () => {
    return tickets.filter(t => {
      const tags = t.tags || [];
      const description = (t.description || '').toLowerCase();
      
      return tags.includes('multi-department') ||
             description.includes('it') && description.includes('facilities') ||
             description.includes('av') && description.includes('setup');
    });
  };

  // Activity feed
  const getActivityFeed = () => {
    const activities = [];
    
    tickets.slice(0, 50).forEach(ticket => {
      // Ticket creation
      activities.push({
        type: 'created',
        ticket,
        timestamp: new Date(ticket.created_date),
        message: `${ticket.requester_name || 'Someone'} created ticket`,
        user: ticket.requester_name
      });

      // Assignment
      if (ticket.assigned_to) {
        activities.push({
          type: 'assigned',
          ticket,
          timestamp: new Date(ticket.updated_date || ticket.created_date),
          message: `Assigned to ${ticket.assigned_to_name || ticket.assigned_to}`,
          user: 'System'
        });
      }

      // Status changes
      if (ticket.status === 'resolved' && ticket.resolved_at) {
        activities.push({
          type: 'resolved',
          ticket,
          timestamp: new Date(ticket.resolved_at),
          message: `Marked as resolved`,
          user: ticket.assigned_to_name || 'Staff'
        });
      }

      // Comments
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
    return matchesStatus && matchesPriority && matchesSource;
  });

  const ticketsByDept = {
    it: filteredTickets.filter(t => getDepartment(t.category) === 'it'),
    facilities: filteredTickets.filter(t => getDepartment(t.category) === 'facilities'),
    comms: filteredTickets.filter(t => getDepartment(t.category) === 'comms'),
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
    }
  ];

  const escalations = getEscalations();
  const weeklyTrends = getWeeklyTrends();
  const performanceMetrics = getPerformanceMetrics();
  const hotSpots = getHotSpots();
  const recurringIssues = getRecurringIssues();
  const crossDeptTickets = getCrossDepartmentTickets();
  const activityFeed = getActivityFeed();

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
        {/* Header */}
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
                Operations Dashboard
                {(user?.role === 'admin' || user?.role === 'super_user') && (
                  <Crown className={`w-5 h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                )}
              </h1>
              <p className="text-sm text-slate-600">Command center for Operations Manager</p>
            </div>
          </div>
        </div>

        {/* Preview Mode Banner */}
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="insights">
              <Target className="w-4 h-4 mr-2" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Top Stats with Trends */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">Total Tickets</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredTickets.length}</p>
                    </div>
                    <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-violet-500" />
                  </div>
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
                </CardContent>
              </Card>

              <Card>
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
                    {filteredTickets.filter(t => t.status === 'open' && !t.assigned_to).length} unassigned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">Escalations</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-700">{escalations.length}</p>
                    </div>
                    <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                  </div>
                  <p className="text-xs text-red-600">Needs immediate attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">Cross-Dept</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-700">{crossDeptTickets.length}</p>
                    </div>
                    <GitBranch className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                  </div>
                  <p className="text-xs text-slate-500">Coordination needed</p>
                </CardContent>
              </Card>
            </div>

            {/* Escalation Alerts */}
            {escalations.length > 0 && (
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

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-600" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {departments.map((dept) => {
                    const avgTime = performanceMetrics[dept.id];
                    const status = !avgTime ? 'gray' : avgTime < 3 ? 'green' : avgTime < 6 ? 'yellow' : 'red';
                    return (
                      <div key={dept.id} className={`p-4 rounded-lg ${dept.bgColor} border ${dept.borderColor}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{dept.icon}</span>
                            <p className="font-semibold text-slate-900">{dept.name}</p>
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
                        <p className="text-xs text-slate-600 mt-1">Avg. resolution time</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
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

            {/* Department Sections */}
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
                              <p className="text-center text-sm text-slate-500 py-4">
                                No tickets found
                              </p>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="space-y-6">
            {/* Hot Spots */}
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

            {/* Recurring Issues */}
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

            {/* Cross-Department Coordination */}
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

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-violet-600" />
                  Real-Time Activity Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityFeed.map((activity, index) => {
                    const timeAgo = differenceInHours(new Date(), activity.timestamp);
                    const timeDisplay = timeAgo < 1 
                      ? `${Math.floor(differenceInHours(new Date(), activity.timestamp) * 60)}m ago`
                      : `${timeAgo}h ago`;

                    return (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.type === 'created' ? 'bg-blue-100' :
                          activity.type === 'assigned' ? 'bg-purple-100' :
                          activity.type === 'resolved' ? 'bg-green-100' :
                          'bg-orange-100'
                        }`}>
                          {activity.type === 'created' && <Ticket className="w-4 h-4 text-blue-600" />}
                          {activity.type === 'assigned' && <Users className="w-4 h-4 text-purple-600" />}
                          {activity.type === 'resolved' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          {activity.type === 'comment' && <Activity className="w-4 h-4 text-orange-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900">
                            <span className="font-semibold">{activity.user}</span> {activity.message}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            {activity.ticket.ticket_number} • {activity.ticket.subject}
                          </p>
                          {activity.comment && (
                            <p className="text-xs text-slate-500 mt-1 italic line-clamp-2">
                              "{activity.comment}"
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">{timeDisplay}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}