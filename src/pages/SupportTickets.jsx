
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Ticket as TicketIcon,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  Mail,
  MessageSquare,
  Users,
  Tag,
  Loader2,
  Send,
  Paperclip, // Keep this for file upload
  Sparkles, // Keep this for AI suggestions
  X, // Keep this for removing attachments
  TrendingUp,
  RefreshCw
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
  const [activeTab, setActiveTab] = useState("inbox");
  
  // New ticket form - updated structure
  const [newTicket, setNewTicket] = useState({
    requester_name: "",
    requester_email: "",
    building: "",
    room_number: "",
    subject: "", // This will be the "brief description" from the form
    details: "", // This will be the "provide details" from the form
    priority: "medium",
    category: "other",
    attachments: [] // New field for attachments
  });

  // Ticket comment
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // AI suggestions
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    loadTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, priorityFilter, activeTab, user]); // Added user to dependencies to ensure inbox count updates

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

    // Tab filtering
    if (activeTab === "inbox" && user) {
      filtered = filtered.filter(t => t.assigned_to === user.email && t.status !== "closed");
    } else if (activeTab === "unassigned") {
      filtered = filtered.filter(t => !t.assigned_to && t.status !== "closed");
    } else if (activeTab === "closed") {
      filtered = filtered.filter(t => t.status === "closed");
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.ticket_number?.toLowerCase().includes(query) ||
        t.requester_email?.toLowerCase().includes(query) ||
        t.requester_name?.toLowerCase().includes(query) ||
        t.building?.toLowerCase().includes(query) ||
        t.room_number?.toLowerCase().includes(query)
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
      // Use AI to find similar tickets and suggest solutions
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
        subject: newTicket.subject, // Brief description from form
        description: `${newTicket.subject}\n\n${newTicket.details ? 'Additional Details: ' + newTicket.details : ''}`.trim(), // Combined for API
        building: newTicket.building,
        room_number: newTicket.room_number,
        status: "open",
        priority: newTicket.priority,
        category: newTicket.category,
        source: "web_form",
        attachments: newTicket.attachments,
        last_activity_at: new Date().toISOString()
      };

      // Find similar tickets and suggest solutions based on the main subject/brief description
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
        category: "other",
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

  const myTicketsCount = tickets.filter(t => t.assigned_to === user?.email && t.status !== "closed").length;
  const unassignedCount = tickets.filter(t => !t.assigned_to && t.status !== "closed").length;

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-blue-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={TicketIcon}
          title="Support Tickets"
          description="Front.com-inspired ticket management system"
          iconColor="from-purple-500 to-indigo-500"
          action={
            <div className="flex items-center gap-2">
              <Button onClick={loadTickets} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setShowNewTicketDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </div>
          }
        />

        {/* Filters and Search */}
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

        {/* Tabs */}
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
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <TicketIcon className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-500 mb-2">No tickets found</p>
                  <p className="text-sm text-slate-400">
                    {activeTab === "inbox" ? "You have no assigned tickets" : 
                     activeTab === "unassigned" ? "All tickets are assigned" :
                     "No closed tickets"}
                  </p>
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
      </div>

      {/* New Ticket Dialog - UPDATED */}
      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">FBCA Service Requests</DialogTitle>
            <p className="text-slate-400 text-sm">Fill out the following form for all service requests.</p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Row 1: Name and Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Name<span className="text-red-500">*</span>
                </label>
                <Input
                  value={newTicket.requester_name}
                  onChange={(e) => setNewTicket({...newTicket, requester_name: e.target.value})}
                  placeholder="Name of Requester"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Email Address<span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={newTicket.requester_email}
                  onChange={(e) => setNewTicket({...newTicket, requester_email: e.target.value})}
                  placeholder="Requester Email"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Row 2: Building and Room Number */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Building(s)<span className="text-red-500">*</span>
                </label>
                <Select value={newTicket.building} onValueChange={(value) => setNewTicket({...newTicket, building: value})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select option..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="main_campus">Main Campus</SelectItem>
                    <SelectItem value="worship_center">Worship Center</SelectItem>
                    <SelectItem value="education_building">Education Building</SelectItem>
                    <SelectItem value="admin_building">Admin Building</SelectItem>
                    <SelectItem value="family_life_center">Family Life Center</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Room Number</label>
                <Input
                  value={newTicket.room_number}
                  onChange={(e) => setNewTicket({...newTicket, room_number: e.target.value})}
                  placeholder="Room number or common name"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Row 3: Category and Brief Description */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Ticket Category<span className="text-red-500">*</span>
                </label>
                <Select value={newTicket.category} onValueChange={(value) => setNewTicket({...newTicket, category: value})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select option..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="technical">Technical / IT</SelectItem>
                    <SelectItem value="facility">Facilities / Maintenance</SelectItem>
                    <SelectItem value="av_production">AV / Production</SelectItem>
                    <SelectItem value="access">Access / Security</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="catering">Catering / Hospitality</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Provide brief description of the issue<span className="text-red-500">*</span>
                </label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  placeholder="Describe your issue"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Row 4: Details and Priority */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Provide details of the issue</label>
                <Textarea
                  value={newTicket.details}
                  onChange={(e) => setNewTicket({...newTicket, details: e.target.value})}
                  placeholder="Provide more details if needed"
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Priority</label>
                <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({...newTicket, priority: value})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Attachments</label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center bg-slate-800/50 hover:bg-slate-800 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Paperclip className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Drop your files here to upload</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                </label>
              </div>
              {newTicket.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newTicket.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 p-2 rounded">
                      <Paperclip className="w-4 h-4" />
                      <span className="flex-1">{file.name}</span>
                      <button
                        onClick={() => setNewTicket({
                          ...newTicket,
                          attachments: newTicket.attachments.filter((_, i) => i !== idx)
                        })}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Loading State */}
            {loadingSuggestions && (
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Finding similar tickets and solutions...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleCreateTicket} 
              disabled={loadingSuggestions}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg h-12"
            >
              Submit
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
                        <span className="text-sm capitalize">{selectedTicket.status}</span>
                      </div>
                    </div>
                  </div>
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
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Original Request */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
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

                {/* AI Suggestions */}
                {selectedTicket.suggested_solution && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
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

                {/* Comments Thread */}
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

                {/* Add Comment */}
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
