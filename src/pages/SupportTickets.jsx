import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Ticket as TicketIcon,
  Plus,
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  Mail,
  Users,
  Loader2,
  Send,
  Paperclip,
  Sparkles,
  X,
  RefreshCw,
  TrendingUp,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import AppHeader from "../components/shared/AppHeader";

export default function SupportTickets() {
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("inbox");
  
  const [newTicket, setNewTicket] = useState({
    requester_name: "",
    requester_email: "",
    building: "",
    room_number: "",
    subject: "",
    details: "",
    priority: "medium",
    category: "",
    attachments: []
  });

  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const navigate = useNavigate();

  // Determine user role/permissions
  const isSupportStaff = user?.department && ['facilities', 'it', 'hospitality'].includes(user.department.toLowerCase());
  const isSuperUser = user?.role === 'super_user' || user?.role === 'admin';
  const isNormalUser = !isSupportStaff && !isSuperUser;

  // Category options based on role
  const normalUserCategories = ['facility', 'facility', 'technical']; // Maintenance, Cleaning, IT Support
  const supportCategories = ['facility', 'technical', 'access', 'facility', 'facility']; // All categories

  const availableCategories = isNormalUser ? [
    { value: 'facility', label: 'Maintenance' },
    { value: 'facility_cleaning', label: 'Cleaning' },
    { value: 'technical', label: 'IT Support' }
  ] : [
    { value: 'facility', label: 'Maintenance' },
    { value: 'facility_cleaning', label: 'Cleaning' },
    { value: 'technical', label: 'IT Support' },
    { value: 'access', label: 'Building Access' },
    { value: 'facility_setup', label: 'Setup' },
    { value: 'facility_teardown', label: 'Teardown' }
  ];

  useEffect(() => {
    loadUser();
    loadTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter, activeTab, user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const allTickets = await base44.entities.Ticket.list('-created_date');
      setTickets(allTickets);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    // Role-based filtering
    if (isNormalUser) {
      // Normal users see only their own tickets
      filtered = filtered.filter(t => t.requester_email === user?.email);
    } else if (isSupportStaff && !isSuperUser) {
      // Support staff see tickets for their department
      const deptCategories = {
        'facilities': ['facility', 'facility_cleaning', 'facility_setup', 'facility_teardown', 'access'],
        'it': ['technical'],
        'hospitality': ['catering']
      };
      const myCategories = deptCategories[user.department?.toLowerCase()] || [];
      filtered = filtered.filter(t => myCategories.includes(t.category));
    }
    // Super users see all tickets (no filter)

    // Tab filtering
    if (activeTab === "inbox" && (isSupportStaff || isSuperUser)) {
      filtered = filtered.filter(t => t.assigned_to === user.email && t.status !== "closed");
    } else if (activeTab === "unassigned" && (isSupportStaff || isSuperUser)) {
      filtered = filtered.filter(t => !t.assigned_to && t.status !== "closed");
    } else if (activeTab === "closed") {
      filtered = filtered.filter(t => t.status === "closed");
    }

    // Additional filters
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.ticket_number?.toLowerCase().includes(query) ||
        t.requester_email?.toLowerCase().includes(query) ||
        t.requester_name?.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  };

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `TKT-${timestamp}`;
  };

  const findSimilarTickets = async (description) => {
    setLoadingSuggestions(true);
    try {
      const prompt = `Analyze this support ticket description and find patterns:
"${description}"

Based on historical FBCA support tickets, suggest:
1. Similar past issues
2. Common solutions
3. Relevant documentation or resources

Keep response concise and actionable.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      return response;
    } catch (error) {
      console.error("Error finding similar tickets:", error);
      return null;
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.requester_name || !newTicket.requester_email || !newTicket.subject || !newTicket.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const ticketData = {
        ticket_number: generateTicketNumber(),
        requester_email: newTicket.requester_email,
        requester_name: newTicket.requester_name,
        subject: newTicket.subject,
        description: `${newTicket.subject}\n\n${newTicket.details ? 'Additional Details: ' + newTicket.details : ''}`.trim(),
        building: newTicket.building,
        room_number: newTicket.room_number,
        status: "open",
        priority: newTicket.priority,
        category: newTicket.category,
        source: "web_form",
        attachments: newTicket.attachments,
        last_activity_at: new Date().toISOString()
      };

      const suggestion = await findSimilarTickets(newTicket.subject);
      if (suggestion) {
        ticketData.suggested_solution = suggestion;
      }

      await base44.entities.Ticket.create(ticketData);
      
      toast.success("Ticket created successfully!");
      setShowNewTicketDialog(false);
      setNewTicket({
        requester_name: "",
        requester_email: "",
        building: "",
        room_number: "",
        subject: "",
        details: "",
        priority: "medium",
        category: "",
        attachments: []
      });
      loadTickets();
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create ticket");
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return {
          name: file.name,
          url: file_url,
          uploaded_at: new Date().toISOString()
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setNewTicket({
        ...newTicket,
        attachments: [...newTicket.attachments, ...uploadedFiles]
      });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;

    setSendingComment(true);
    try {
      const comment = {
        author_email: user.email,
        author_name: user.full_name || user.email,
        content: newComment,
        is_internal: false,
        timestamp: new Date().toISOString()
      };

      const updatedComments = [...(selectedTicket.comments || []), comment];
      
      await base44.entities.Ticket.update(selectedTicket.id, {
        comments: updatedComments,
        last_activity_at: new Date().toISOString()
      });

      setSelectedTicket({
        ...selectedTicket,
        comments: updatedComments
      });

      setNewComment("");
      toast.success("Comment added");
      loadTickets();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSendingComment(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      const updates = {
        status: newStatus,
        last_activity_at: new Date().toISOString()
      };

      if (newStatus === "resolved") {
        updates.resolved_at = new Date().toISOString();
      } else if (newStatus === "closed") {
        updates.closed_at = new Date().toISOString();
      }

      await base44.entities.Ticket.update(ticketId, updates);
      toast.success(`Ticket ${newStatus}`);
      loadTickets();
      
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, ...updates });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleAssignToMe = async (ticketId) => {
    try {
      await base44.entities.Ticket.update(ticketId, {
        assigned_to: user.email,
        assigned_to_name: user.full_name || user.email,
        status: "in_progress",
        last_activity_at: new Date().toISOString()
      });
      toast.success("Ticket assigned to you");
      loadTickets();
    } catch (error) {
      console.error("Error assigning ticket:", error);
      toast.error("Failed to assign ticket");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      case "resolved": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "closed": return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Calculate workload stats
  const getWorkloadStats = () => {
    const stats = {
      facilities: { open: 0, inProgress: 0 },
      it: { open: 0, inProgress: 0 },
      hospitality: { open: 0, inProgress: 0 }
    };

    tickets.forEach(t => {
      if (t.status === 'closed') return;
      
      let dept = '';
      if (['facility', 'facility_cleaning', 'facility_setup', 'facility_teardown', 'access'].includes(t.category)) {
        dept = 'facilities';
      } else if (t.category === 'technical') {
        dept = 'it';
      } else if (t.category === 'catering') {
        dept = 'hospitality';
      }

      if (dept) {
        if (t.status === 'open') stats[dept].open++;
        else if (t.status === 'in_progress') stats[dept].inProgress++;
      }
    });

    return stats;
  };

  const workloadStats = getWorkloadStats();
  const myTicketsCount = tickets.filter(t => t.assigned_to === user?.email && t.status !== "closed").length;
  const unassignedCount = tickets.filter(t => !t.assigned_to && t.status !== "closed").length;

  // Generate shareable link
  const createTicketLink = `${window.location.origin}${createPageUrl('CreateTicket')}`;

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={TicketIcon}
          title="Support Tickets"
          description={isNormalUser ? "Submit and track your service requests" : "Manage support tickets and service requests"}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <div className="flex items-center gap-2">
              {(isSupportStaff || isSuperUser) && (
                <Button onClick={loadTickets} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              )}
              <Button onClick={() => {
                setNewTicket({
                  ...newTicket,
                  requester_name: user?.full_name || "",
                  requester_email: user?.email || ""
                });
                setShowNewTicketDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </div>
          }
        />

        {/* Shareable Link Card */}
        {(isSupportStaff || isSuperUser) && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Shareable Ticket Creation Link</p>
                  <p className="text-xs text-blue-700 mt-1">{createTicketLink}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(createTicketLink);
                    toast.success("Link copied to clipboard!");
                  }}
                >
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workload Overview - For Normal Users */}
        {isNormalUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Service Department Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-900 mb-2">Facilities</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{workloadStats.facilities.open}</p>
                      <p className="text-xs text-orange-700">Open</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-500">{workloadStats.facilities.inProgress}</p>
                      <p className="text-xs text-orange-600">In Progress</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">IT Support</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{workloadStats.it.open}</p>
                      <p className="text-xs text-blue-700">Open</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-500">{workloadStats.it.inProgress}</p>
                      <p className="text-xs text-blue-600">In Progress</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-900 mb-2">Hospitality</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{workloadStats.hospitality.open}</p>
                      <p className="text-xs text-green-700">Open</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{workloadStats.hospitality.inProgress}</p>
                      <p className="text-xs text-green-600">In Progress</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters - For Support Staff */}
        {(isSupportStaff || isSuperUser) && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs - For Support Staff */}
        {(isSupportStaff || isSuperUser) ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inbox" className="relative">
                Inbox
                {myTicketsCount > 0 && (
                  <Badge className="ml-2 bg-blue-500 text-white">
                    {myTicketsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="relative">
                Unassigned
                {unassignedCount > 0 && (
                  <Badge className="ml-2 bg-orange-500 text-white">
                    {unassignedCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="closed">
                Closed
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TicketIcon className="w-16 h-16 text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-2">No tickets found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowTicketDetail(true);
                      }}
                    >
                      <Card className="hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getStatusIcon(ticket.status)}
                                <h3 className="font-semibold text-slate-900">
                                  {ticket.subject}
                                </h3>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {ticket.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {ticket.requester_email}
                                </span>
                                {ticket.ticket_number && (
                                  <span className="font-mono">{ticket.ticket_number}</span>
                                )}
                                {ticket.assigned_to && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {ticket.assigned_to_name || ticket.assigned_to}
                                  </span>
                                )}
                                <span>
                                  {format(new Date(ticket.created_date), 'MMM d, h:mm a')}
                                </span>
                              </div>
                            </div>
                            {!ticket.assigned_to && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAssignToMe(ticket.id);
                                }}
                              >
                                Assign to Me
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // Normal User - My Tickets View
          <Card>
            <CardHeader>
              <CardTitle>My Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <TicketIcon className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-500 mb-2">No tickets yet</p>
                  <p className="text-sm text-slate-400">Click "New Ticket" to submit a service request</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredTickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowTicketDetail(true);
                      }}
                    >
                      <Card className="hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getStatusIcon(ticket.status)}
                                <h3 className="font-semibold text-slate-900">
                                  {ticket.subject}
                                </h3>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {ticket.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                {ticket.ticket_number && (
                                  <span className="font-mono">{ticket.ticket_number}</span>
                                )}
                                <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                                <span>
                                  {format(new Date(ticket.created_date), 'MMM d, h:mm a')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Ticket Dialog - Light Theme */}
      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">FBCA Service Request</DialogTitle>
            <p className="text-slate-600 text-sm">Fill out the following form for all service requests.</p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Name<span className="text-red-500">*</span>
                </label>
                <Input
                  value={newTicket.requester_name}
                  onChange={(e) => setNewTicket({...newTicket, requester_name: e.target.value})}
                  placeholder="Name of Requester"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email Address<span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={newTicket.requester_email}
                  onChange={(e) => setNewTicket({...newTicket, requester_email: e.target.value})}
                  placeholder="Requester Email"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Building<span className="text-red-500">*</span>
                </label>
                <Select value={newTicket.building} onValueChange={(value) => setNewTicket({...newTicket, building: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wade">WADE</SelectItem>
                    <SelectItem value="fbc">FBC</SelectItem>
                    <SelectItem value="pcb">PCB</SelectItem>
                    <SelectItem value="student_center">Student Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Room Number</label>
                <Input
                  value={newTicket.room_number}
                  onChange={(e) => setNewTicket({...newTicket, room_number: e.target.value})}
                  placeholder="Room number or common name"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Category<span className="text-red-500">*</span>
                </label>
                <Select value={newTicket.category} onValueChange={(value) => setNewTicket({...newTicket, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Brief Description<span className="text-red-500">*</span>
                </label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  placeholder="Describe your issue"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Details</label>
                <Textarea
                  value={newTicket.details}
                  onChange={(e) => setNewTicket({...newTicket, details: e.target.value})}
                  placeholder="Provide more details if needed"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({...newTicket, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Attachments</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Paperclip className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Drop your files here to upload</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                </label>
              </div>
              {newTicket.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newTicket.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-100 p-2 rounded">
                      <Paperclip className="w-4 h-4" />
                      <span className="flex-1">{file.name}</span>
                      <button
                        onClick={() => setNewTicket({
                          ...newTicket,
                          attachments: newTicket.attachments.filter((_, i) => i !== idx)
                        })}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loadingSuggestions && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Finding similar tickets and solutions...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTicketDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTicket} 
              disabled={loadingSuggestions}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={showTicketDetail} onOpenChange={setShowTicketDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl mb-2">
                      {selectedTicket.subject}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono text-xs">
                        {selectedTicket.ticket_number}
                      </Badge>
                      <Badge className={getPriorityColor(selectedTicket.priority)}>
                        {selectedTicket.priority}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedTicket.status)}
                        <span className="text-sm capitalize">{selectedTicket.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  {(isSupportStaff || isSuperUser) && (
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(value) => handleUpdateStatus(selectedTicket.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {selectedTicket.requester_name?.[0] || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{selectedTicket.requester_name}</p>
                        <p className="text-xs text-slate-500 mb-2">{selectedTicket.requester_email}</p>
                        {selectedTicket.building && (
                          <p className="text-xs text-slate-500 mb-1">
                            Building: {selectedTicket.building}
                            {selectedTicket.room_number && ` - Room: ${selectedTicket.room_number}`}
                          </p>
                        )}
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {selectedTicket.description}
                        </p>
                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium mb-2">Attachments:</h4>
                            <div className="space-y-2">
                              {selectedTicket.attachments.map((attachment, index) => (
                                <a
                                  key={index}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                >
                                  <Paperclip className="w-4 h-4" />
                                  {attachment.name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                          {format(new Date(selectedTicket.created_date), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedTicket.suggested_solution && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        AI-Suggested Solution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedTicket.suggested_solution}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedTicket.comments.map((comment, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {comment.author_name?.[0] || 'U'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{comment.author_name}</p>
                            <p className="text-xs text-slate-500 mb-1">
                              {format(new Date(comment.timestamp), 'MMM d, h:mm a')}
                            </p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || sendingComment}
                      >
                        {sendingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}