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
  ChevronUp
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
import { format } from "date-fns";

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Check if this is Andy Milliorn or admin/super_user
      const isOperationsManager = currentUser.email?.toLowerCase().includes('andy') || 
                                   currentUser.role === 'admin' || 
                                   currentUser.role === 'super_user';
      
      if (!isOperationsManager) {
        setIsPreviewMode(true);
      }

      // Load all tickets for operations view
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

  // Department mapping based on category
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

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesSource = sourceFilter === "all" || ticket.source === sourceFilter;
    return matchesStatus && matchesPriority && matchesSource;
  });

  // Group by department
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
      <div className="max-w-7xl mx-auto">
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
              <p className="text-sm text-slate-600">Department overview for Operations Manager</p>
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
                    This is Andy Milliorn's Operations Dashboard view. As Operations Manager, he can see all tickets across IT, Facilities, and Communications departments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">Total Tickets</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredTickets.length}</p>
                </div>
                <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">Open</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-700">
                    {filteredTickets.filter(t => t.status === 'open').length}
                  </p>
                </div>
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">In Progress</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-700">
                    {filteredTickets.filter(t => t.status === 'in_progress').length}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600">Urgent</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-700">
                    {filteredTickets.filter(t => t.priority === 'urgent').length}
                  </p>
                </div>
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
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
                        {/* Mini Stats */}
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

                        {/* Ticket List */}
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
      </div>
    </div>
  );
}