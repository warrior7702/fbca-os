import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
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
  User as UserIcon
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

export default function SupportTickets() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

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
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
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
      pending: "bg-yellow-100 text-yellow-700",
      in_progress: "bg-purple-100 text-purple-700",
      resolved: "bg-green-100 text-green-700",
      closed: "bg-slate-100 text-slate-700"
    };
    return colors[status] || colors.open;
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchQuery || 
      ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length
  };

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || searchQuery;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Ticket className="w-6 h-6 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Support Requests
                  {isAdmin && (
                    <Crown className={`inline-block ml-2 w-5 h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                  )}
                </h1>
                <p className="text-sm text-slate-600">
                  {isAdmin ? 'All support tickets' : 'Your support requests'}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(createPageUrl('CreateTicket'))}
            className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  </div>
                  <Ticket className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Open</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.open}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">In Progress</p>
                    <p className="text-2xl font-bold text-purple-700">{stats.in_progress}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Resolved</p>
                    <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
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

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="access">Access</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                  <SelectItem value="av_production">AV/Production</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="catering">Catering</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
            >
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('id', ticket.id);
                  navigate(createPageUrl('SupportTickets') + '?' + params.toString());
                }}
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
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500">
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
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status?.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        {ticket.category && (
                          <Badge variant="secondary">
                            {ticket.category.replace('_', ' ')}
                          </Badge>
                        )}
                        {ticket.building && (
                          <Badge variant="outline" className="text-xs">
                            {ticket.building.replace('_', ' ')}
                            {ticket.room_number && ` - ${ticket.room_number}`}
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
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filteredTickets.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {hasFilters ? 'No tickets match your filters' : 'No tickets yet'}
                </h3>
                <p className="text-slate-600 mb-6">
                  {hasFilters ? 'Try adjusting your search or filters' : 'Create your first support ticket to get started'}
                </p>
                {!hasFilters && (
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
        </div>
      </div>
    </div>
  );
}