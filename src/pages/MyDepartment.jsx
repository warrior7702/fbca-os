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
import { format, subDays, isAfter, isBefore, differenceInHours, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  useEffect(() => {
    loadData();
  }, []);

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
      }

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

  const getTicketsByCategory = () => {
    const categoryData = {};
    filteredTickets.forEach(t => {
      const category = t.category || 'other';
      categoryData[category] = (categoryData[category] || 0) + 1;
    });
    
    const colors = {
      technology: '#3b82f6',
      cleaning: '#10b981',
      maintenance: '#f59e0b',
      av_production: '#8b5cf6',
      marketing: '#ec4899',
      communications: '#6366f1',
      other: '#6b7280'
    };
    
    return Object.entries(categoryData).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value,
      color: colors[name] || colors.other
    }));
  };

  const getMonthlyClosedByDept = () => {
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
      const monthTickets = tickets.filter(t => {
        if (!t.resolved_at) return false;
        const resolvedDate = new Date(t.resolved_at);
        return isAfter(resolvedDate, start) && isBefore(resolvedDate, end);
      });
      
      return {
        month,
        IT: monthTickets.filter(t => getDepartment(t.category) === 'it').length,
        Facilities: monthTickets.filter(t => getDepartment(t.category) === 'facilities').length,
        Communications: monthTickets.filter(t => getDepartment(t.category) === 'comms').length
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
    
    // Filter based on user role
    if (userRole === 'requester') {
      // Requesters only see their own tickets
      return matchesStatus && matchesPriority && matchesSource && 
             ticket.requester_email === user?.email;
    } else if (userRole === 'worker') {
      // Workers see tickets assigned to them + unassigned pool tickets in their department + their own tickets
      const ticketDept = getDepartment(ticket.category);
      const isInUserDept = userDepartments.some(dept => 
        ticketDept === dept.toLowerCase().replace(' ', '_')
      );
      const isUnassignedInDept = !ticket.assigned_to && isInUserDept && 
                                  !['resolved', 'closed'].includes(ticket.status);
      
      return matchesStatus && matchesPriority && matchesSource &&
             (ticket.assigned_to === user?.email || 
              ticket.requester_email === user?.email ||
              isUnassignedInDept);
    } else if (userRole === 'admin') {
      // Admins see everything in their departments
      const ticketDept = getDepartment(ticket.category);
      const isInUserDept = userDepartments.some(dept => 
        ticketDept === dept.toLowerCase().replace(' ', '_')
      );
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
  const categoryData = getTicketsByCategory();
  const monthlyClosedData = getMonthlyClosedByDept();

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
          <TabsList className={`grid w-full ${!isPreviewMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
                {/* Pie Chart - Tickets by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-4 h-4 text-violet-600" />
                      Tickets by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {categoryData.map((entry, index) => (
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
                      {categoryData.map((item, index) => (
                        <div key={index} className="flex items-center gap-1 text-xs">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Tracker - Tickets Closed by Dept */}
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
                        <BarChart data={monthlyClosedData}>
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="IT" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Facilities" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Communications" fill="#8b5cf6" stackId="a" radius={[4, 4, 0, 0]} />
                        </BarChart>
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
                    {userRole === 'requester' ? 'Awaiting response' :
                     userRole === 'worker' ? `${filteredTickets.filter(t => t.status === 'open' && t.assigned_to === user?.email).length} need my attention` :
                     `${filteredTickets.filter(t => t.status === 'open' && !t.assigned_to).length} unassigned`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {userRole === 'worker' ? 'In Progress' : 'Escalations'}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-red-700">
                        {userRole === 'worker' ? 
                          filteredTickets.filter(t => t.status === 'in_progress' && t.assigned_to === user?.email).length :
                          escalations.length}
                      </p>
                    </div>
                    <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                  </div>
                  <p className="text-xs text-red-600">
                    {userRole === 'worker' ? 'Currently working' : 'Needs immediate attention'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {userRole === 'requester' || userRole === 'worker' ? 'Resolved' : 'Cross-Dept'}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-700">
                        {userRole === 'requester' || userRole === 'worker' ?
                          filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length :
                          crossDeptTickets.length}
                      </p>
                    </div>
                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {userRole === 'requester' || userRole === 'worker' ? 'Completed' : 'Coordination needed'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {!isPreviewMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-violet-600" />
                  {userRole === 'worker' ? 'My Assigned Tickets' : 'My Tickets'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTickets.length > 0 ? (
                  <div className="space-y-2">
                    {filteredTickets.map((ticket) => {
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
                              <Badge className={`text-xs ${
                                ticket.status === 'open' ? 'bg-blue-100 text-blue-700' :
                                ticket.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                                ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {ticket.status}
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
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No tickets yet</p>
                    <Button 
                      className="mt-4"
                      onClick={() => navigate(createPageUrl('CreateTicket'))}
                    >
                      Create Your First Ticket
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
                          Welcome to your department page! More features coming soon.
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
          </TabsContent>

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
      </div>
    </div>
  );
}