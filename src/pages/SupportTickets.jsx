import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Ticket,
  Plus,
  Loader2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Filter,
  X,
  Crown,
  MessageSquare,
  Calendar,
  User as UserIcon,
  BarChart3,
  MousePointerClick,
  Zap,
  Mail,
  Workflow,
  CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SupportTickets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('id');
  
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [claiming, setClaiming] = useState(null);

  useEffect(() => {
    if (ticketId) {
      navigate(createPageUrl('TicketDetail') + `?id=${ticketId}`);
      return;
    }
    loadData();
  }, [ticketId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const adminStatus = currentUser?.role === 'admin' || currentUser?.role === 'super_user';
      setIsAdmin(adminStatus);

      let ticketsData;
      if (adminStatus) {
        ticketsData = await base44.entities.Ticket.list('-created_date');
      } else {
        ticketsData = await base44.entities.Ticket.filter({
          requester_email: currentUser.email
        });
      }
      
      // Filter to show only support request tickets (technology, cleaning, maintenance)
      // Exclude workflow/communications tickets and archived tickets
      ticketsData = ticketsData.filter(t => 
        t.category && 
        ['technology', 'cleaning', 'maintenance'].includes(t.category) && 
        t.status !== 'archived'
      );
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (source) => {
    const sourceConfig = {
      manual_request: {
        label: "Requested",
        icon: MousePointerClick,
        className: "bg-blue-100 text-blue-700 border-blue-300"
      },
      pco_auto: {
        label: "PCO Auto",
        icon: Zap,
        className: "bg-purple-100 text-purple-700 border-purple-300"
      },
      email: {
        label: "Email",
        icon: Mail,
        className: "bg-green-100 text-green-700 border-green-300"
      },
      workflow: {
        label: "Workflow",
        icon: Workflow,
        className: "bg-orange-100 text-orange-700 border-orange-300"
      }
    };

    const config = sourceConfig[source] || sourceConfig.manual_request;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.className} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: "bg-red-100 text-red-700 border-red-300",
      high: "bg-orange-100 text-orange-700 border-orange-300",
      medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
      low: "bg-blue-100 text-blue-700 border-blue-300"
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      open: "bg-blue-100 text-blue-700",
      awaiting_information: "bg-yellow-100 text-yellow-700",
      awaiting_parts: "bg-orange-100 text-orange-700",
      resolved: "bg-green-100 text-green-700",
      archived: "bg-slate-100 text-slate-700"
    };
    return colors[status] || colors.open;
  };

  // Define status order for sorting
  const statusOrder = {
    'open': 1,
    'awaiting_information': 2,
    'awaiting_parts': 3,
    'resolved': 4,
    'archived': 5
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchQuery || 
      ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Tab filtering
    let matchesTab = true;
    if (activeTab === "active") {
      matchesTab = ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'].includes(ticket.status);
    } else if (activeTab === "pool") {
      matchesTab = !ticket.assigned_to && ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'].includes(ticket.status);
    } else if (activeTab === "resolved") {
      matchesTab = ticket.status === 'resolved';
    }
    
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
    
    return matchesSearch && matchesTab && matchesPriority && matchesCategory;
  }).sort((a, b) => {
    // First sort by status
    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;
    
    // Then by due date (earliest first, no due date last)
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return aDue - bDue;
  });

  const stats = {
    total: tickets.length,
    active: tickets.filter(t => ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length,
    open: tickets.filter(t => t.status === 'open').length,
    awaiting_info: tickets.filter(t => t.status === 'awaiting_information').length,
    awaiting_parts: tickets.filter(t => t.status === 'awaiting_parts').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  const hasFilters = priorityFilter !== "all" || categoryFilter !== "all" || searchQuery;

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setCategoryFilter("all");
  };

  const handleClaimTicket = async (e, ticketId) => {
    e.stopPropagation();
    setClaiming(ticketId);
    try {
      await base44.entities.Ticket.update(ticketId, {
        assigned_to: user.email,
        assigned_to_name: user.full_name,
        status: 'open',
        last_activity_at: new Date().toISOString()
      });
      
      toast.success('Ticket claimed!');
      loadData();
    } catch (error) {
      console.error('Failed to claim ticket:', error);
      toast.error('Failed to claim ticket');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Support Requests
                  {isAdmin && (
                    <Crown className={`inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {isAdmin ? 'All support tickets' : 'Your support requests'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Button
                onClick={() => navigate(createPageUrl('TicketReporting'))}
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                size="sm"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Reports & Analytics</span>
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl('CreateTicket'))}
              className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Ticket</span>
            </Button>
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Open</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-700">{stats.open}</p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Awaiting Info</p>
                    <p className="text-xl sm:text-2xl font-bold text-yellow-700">{stats.awaiting_info}</p>
                  </div>
                  <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Awaiting Parts</p>
                    <p className="text-xl sm:text-2xl font-bold text-orange-700">{stats.awaiting_parts}</p>
                  </div>
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Resolved</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.resolved}</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="active" className="gap-2">
              Active
              {stats.active > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.active}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pool" className="gap-2">
              Unassigned Pool
              {tickets.filter(t => !t.assigned_to && ['open', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length > 0 && (
                <Badge className="ml-1 bg-orange-500">
                  {tickets.filter(t => !t.assigned_to && ['open', 'in_progress', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2">
              Resolved
              {stats.resolved > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.resolved}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-sm"
                />

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="text-sm">
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

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <TabsContent value={activeTab} className="space-y-4">
            {/* Group tickets by status */}
            {['open', 'awaiting_information', 'awaiting_parts', 'resolved'].map(status => {
              const statusTickets = filteredTickets.filter(t => t.status === status);
              if (statusTickets.length === 0) return null;
              
              const statusLabels = {
                'open': 'Open',
                'awaiting_information': 'Awaiting Information',
                'awaiting_parts': 'Awaiting Parts',
                'resolved': 'Resolved'
              };
              const statusColors = {
                'open': 'text-blue-700 bg-blue-50 border-blue-200',
                'awaiting_information': 'text-yellow-700 bg-yellow-50 border-yellow-200',
                'awaiting_parts': 'text-orange-700 bg-orange-50 border-orange-200',
                'resolved': 'text-green-700 bg-green-50 border-green-200'
              };
              
              return (
                <div key={status} className="space-y-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${statusColors[status]}`}>
                    <span className="font-semibold text-sm">{statusLabels[status]}</span>
                    <Badge variant="secondary" className="text-xs">{statusTickets.length}</Badge>
                  </div>
                  
                  {statusTickets.map((ticket) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
            >
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticket.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                      </div>
                      
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {ticket.description}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono">{ticket.ticket_number}</span>
                        <span>•</span>
                        <Calendar className="w-3 h-3" />
                        {format(new Date(ticket.created_date), 'MMM d, yyyy')}
                        {ticket.requester_name && (
                          <>
                            <span>•</span>
                            <UserIcon className="w-3 h-3" />
                            {ticket.requester_name}
                          </>
                        )}
                        {ticket.building && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {ticket.building.replace('_', ' ')}
                              {ticket.room_number && ` - ${ticket.room_number}`}
                            </Badge>
                          </>
                        )}
                        {ticket.due_date && (
                          <>
                            <span>•</span>
                            <CalendarDays className="w-3 h-3 text-orange-600" />
                            <span className="text-orange-600 font-medium">
                              Due {format(new Date(ticket.due_date), 'MMM d')}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {getSourceBadge(ticket.source || 'manual_request')}
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status?.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                          {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                        </Badge>
                        {ticket.category && (
                          <Badge variant="secondary">
                            {ticket.category.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </Badge>
                        )}
                        {ticket.comments && ticket.comments.length > 0 && (
                         <Badge variant="outline" className="text-xs flex items-center gap-1">
                           <MessageSquare className="w-3 h-3" />
                           {ticket.comments.length}
                         </Badge>
                        )}
                        </div>
                        </div>

                        {activeTab === 'pool' && !ticket.assigned_to && (
                        <Button
                        onClick={(e) => handleClaimTicket(e, ticket.id)}
                        disabled={claiming === ticket.id}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-shrink-0"
                        size="sm"
                        >
                        {claiming === ticket.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Users className="w-4 h-4 mr-2" />
                            Claim
                          </>
                        )}
                        </Button>
                        )}
                        </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

            )})}

            {filteredTickets.length === 0 && !loading && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {hasFilters ? 'No tickets match your filters' : activeTab === 'active' ? 'No active tickets' : 'No resolved tickets'}
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {hasFilters ? 'Try adjusting your search or filters' : activeTab === 'active' ? 'Create your first support ticket to get started' : 'Resolved tickets will appear here'}
                  </p>
                  {!hasFilters && activeTab === 'active' && (
                    <Button
                      onClick={() => navigate(createPageUrl('CreateTicket'))}
                      className="bg-gradient-to-r from-amber-600 to-yellow-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Ticket
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}