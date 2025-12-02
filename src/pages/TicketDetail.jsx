import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Ticket as TicketIcon,
  ArrowLeft,
  MessageSquare,
  Send,
  Paperclip,
  User,
  Users as UsersIcon,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Sparkles,
  Users,
  Calendar,
  Tag,
  TrendingUp,
  X,
  Mail,
  ExternalLink,
  MousePointerClick,
  Zap,
  Workflow,
  CalendarDays,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

export default function TicketDetail() {
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('id');
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [teams, setTeams] = useState([]);
  const [aiDraftResponse, setAiDraftResponse] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAIDraft, setShowAIDraft] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [scanningTicket, setScanningTicket] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [tempBuilding, setTempBuilding] = useState("");
  const [tempRoomNumber, setTempRoomNumber] = useState("");
  const [updatingDueDate, setUpdatingDueDate] = useState(false);
  const [dueDateValue, setDueDateValue] = useState("");

  const commentsEndRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.comments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadData = async () => {
    if (!ticketId) {
      navigate(createPageUrl('SupportTickets'));
      return;
    }

    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const adminStatus = currentUser?.role === 'admin' || currentUser?.role === 'super_user';
      setIsAdmin(adminStatus);
      
      // Check if user is a ticket worker
      const ticketRoles = await base44.entities.TicketRoleAssignment.filter({
        user_email: currentUser.email
      });
      const workerStatus = ticketRoles.some(r => r.ticket_role === 'worker');
      setIsWorker(workerStatus);

      const tickets = await base44.entities.Ticket.filter({ id: ticketId });
      if (tickets && tickets.length > 0) {
        setTicket(tickets[0]);
        // Initialize due date value
        const dueDate = tickets[0].due_date;
        if (dueDate) {
          setDueDateValue(dueDate.includes('T') ? dueDate.split('T')[0] : dueDate);
        } else {
          setDueDateValue("");
        }
        
        // Calculate time to first response if not set
        if (adminStatus && !tickets[0].time_to_first_response && tickets[0].comments?.length > 0) {
          const firstStaffComment = tickets[0].comments.find(c => c.author_email !== tickets[0].requester_email);
          if (firstStaffComment) {
            const responseTime = (new Date(firstStaffComment.timestamp) - new Date(tickets[0].created_date)) / 1000 / 60;
            await base44.entities.Ticket.update(ticketId, {
              time_to_first_response: Math.round(responseTime)
            });
          }
        }
      } else {
        toast.error('Ticket not found');
        navigate(createPageUrl('SupportTickets'));
      }

      // Load workers with ticket roles for assignment
      if (adminStatus || workerStatus) {
        const ticketWorkers = await base44.entities.TicketRoleAssignment.filter({
          ticket_role: 'worker'
        });
        
        let workers = ticketWorkers.map(w => ({
          email: w.user_email,
          full_name: w.user_name || w.user_email
        }));
        
        // If no workers defined, fall back to all users (for initial setup)
        if (workers.length === 0) {
          const allUsers = await base44.entities.User.list();
          workers = allUsers.map(u => ({
            email: u.email,
            full_name: u.full_name || u.email
          }));
        }
        
        setStaffMembers(workers);
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = {
        author_email: user.email,
        author_name: user.full_name || user.email,
        content: newComment.trim(),
        is_internal: isInternalComment,
        timestamp: new Date().toISOString()
      };

      const updatedComments = [...(ticket.comments || []), comment];
      
      await base44.entities.Ticket.update(ticketId, {
        comments: updatedComments,
        last_activity_at: new Date().toISOString()
      });

      setTicket({ ...ticket, comments: updatedComments });
      setNewComment("");
      toast.success('Comment added');

      // Send notifications
      if (!isInternalComment) {
        // Notify requester about comment
        try {
          await base44.functions.invoke('createNotification', {
            user_email: ticket.requester_email,
            type: 'ticket_comment',
            title: `New comment on ${ticket.ticket_number}`,
            message: comment.content,
            related_ticket_id: ticketId,
            related_ticket_number: ticket.ticket_number,
            action_url: `/support-tickets?id=${ticketId}`,
            send_email: true
          });
        } catch (notifyError) {
          console.warn('Requester notification failed:', notifyError);
        }
      }

      // Notify workers in department about new comment
      try {
        const rolesResponse = await base44.functions.invoke('getUsersWithTicketRoles');
        if (rolesResponse.data.success) {
          const getDepartment = (category) => {
            const deptMap = {
              'technology': 'IT',
              'cleaning': 'Facilities',
              'maintenance': 'Facilities'
            };
            return deptMap[category] || null;
          };

          const department = getDepartment(ticket.category);
          if (department) {
            const departmentWorkers = rolesResponse.data.allUsers.filter(user => 
              user.ticket_role === 'worker' && 
              user.departments && 
              user.departments.includes(department) &&
              user.user_email !== user.email // Don't notify the commenter
            );

            for (const worker of departmentWorkers) {
              await base44.functions.invoke('createNotification', {
                user_email: worker.user_email,
                type: 'ticket_comment',
                title: `Comment on ${ticket.ticket_number}`,
                message: `${comment.author_name}: ${comment.content.substring(0, 100)}...`,
                related_ticket_id: ticketId,
                related_ticket_number: ticket.ticket_number,
                action_url: `/support-tickets?id=${ticketId}`,
                send_email: false // Only in-app notification for workers
              });
            }
          }
        }
      } catch (workerNotifyError) {
        console.warn('Worker notification failed:', workerNotifyError);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const updateData = {
        status: newStatus,
        last_activity_at: new Date().toISOString()
      };

      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        const resolutionTime = (new Date() - new Date(ticket.created_date)) / 1000 / 60;
        updateData.time_to_resolution = Math.round(resolutionTime);
      }

      if (newStatus === 'archived') {
        updateData.archived_at = new Date().toISOString();
      }

      await base44.entities.Ticket.update(ticketId, updateData);
      setTicket({ ...ticket, ...updateData });
      toast.success(`Ticket ${newStatus}`);

      // Send notification to requester about status change
      const statusMessages = {
        'awaiting_information': 'needs more information from you',
        'awaiting_parts': 'is waiting for parts to arrive',
        'resolved': 'has been resolved'
      };

      if (statusMessages[newStatus]) {
        try {
          await base44.functions.invoke('createNotification', {
            user_email: ticket.requester_email,
            type: 'ticket_status_change',
            title: `Ticket ${ticket.ticket_number} status updated`,
            message: `Your ticket ${statusMessages[newStatus]}`,
            related_ticket_id: ticketId,
            related_ticket_number: ticket.ticket_number,
            action_url: `/support-tickets?id=${ticketId}`,
            send_email: true
          });
        } catch (notifyError) {
          console.warn('Status notification failed:', notifyError);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    try {
      await base44.entities.Ticket.update(ticketId, {
        priority: newPriority,
        last_activity_at: new Date().toISOString()
      });
      setTicket({ ...ticket, priority: newPriority });
      toast.success('Priority updated');
    } catch (error) {
      console.error('Error updating priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const handleCategoryChange = async (newCategory) => {
    try {
      await base44.entities.Ticket.update(ticketId, {
        category: newCategory,
        last_activity_at: new Date().toISOString()
      });
      setTicket({ ...ticket, category: newCategory });
      toast.success('Category updated');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  const handleAssignment = async (staffEmail) => {
    try {
      const staffMember = staffMembers.find(s => s.email === staffEmail);
      await base44.entities.Ticket.update(ticketId, {
        assigned_to: staffEmail,
        assigned_to_name: staffMember?.full_name || staffEmail,
        last_activity_at: new Date().toISOString()
      });
      setTicket({ 
        ...ticket, 
        assigned_to: staffEmail,
        assigned_to_name: staffMember?.full_name || staffEmail
      });
      toast.success(`Assigned to ${staffMember?.full_name || staffEmail}`);

      // Send notification to assigned person
      try {
        await base44.functions.invoke('sendTicketNotification', {
          ticket_id: ticketId,
          notification_type: 'assigned',
          assigned_to: staffEmail
        });
      } catch (emailError) {
        console.warn('Email notification failed:', emailError);
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Failed to assign ticket');
    }
  };

  const handleDueDateChange = async (newDueDate) => {
    setUpdatingDueDate(true);
    try {
      console.log('Updating due date to:', newDueDate, 'for ticket:', ticket.id);
      await base44.entities.Ticket.update(ticket.id, {
        due_date: newDueDate,
        last_activity_at: new Date().toISOString()
      });
      // Re-fetch the ticket to ensure we have the latest data
      const refreshedTickets = await base44.entities.Ticket.filter({ id: ticket.id });
      if (refreshedTickets && refreshedTickets.length > 0) {
        setTicket(refreshedTickets[0]);
        // Update local state too
        const refreshedDueDate = refreshedTickets[0].due_date;
        if (refreshedDueDate) {
          setDueDateValue(refreshedDueDate.includes('T') ? refreshedDueDate.split('T')[0] : refreshedDueDate);
        }
      }
      toast.success('Due date updated');
    } catch (error) {
      console.error('Error updating due date:', error);
      toast.error('Failed to update due date');
    } finally {
      setUpdatingDueDate(false);
    }
  };

  const handleDeleteTicket = async () => {
    setDeleting(true);
    try {
      await base44.entities.Ticket.delete(ticketId);
      toast.success('Ticket deleted');
      navigate(createPageUrl('SupportTickets'));
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket');
      setDeleting(false);
    }
  };

  const handleStartEditLocation = () => {
    setTempBuilding(ticket.building || "");
    setTempRoomNumber(ticket.room_number || "");
    setEditingLocation(true);
  };

  const handleSaveLocation = async () => {
    try {
      await base44.entities.Ticket.update(ticketId, {
        building: tempBuilding,
        room_number: tempRoomNumber,
        last_activity_at: new Date().toISOString()
      });
      setTicket({ ...ticket, building: tempBuilding, room_number: tempRoomNumber });
      setEditingLocation(false);
      toast.success('Location updated');
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Failed to update location');
    }
  };

  const handleGenerateAIResponse = async (type = 'response') => {
    setGeneratingAI(true);
    try {
      const response = await base44.functions.invoke('generateAITicketResponse', {
        ticket_id: ticketId,
        response_type: type
      });
      
      if (response.data.success) {
        setAiDraftResponse(response.data.response);
        setShowAIDraft(true);
        toast.success('AI draft generated');
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      toast.error('Failed to generate AI response');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleUseAIDraft = () => {
    setNewComment(aiDraftResponse);
    setShowAIDraft(false);
    toast.success('AI draft copied to comment');
  };

  const handleAIScan = async () => {
    setScanningTicket(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a facilities/IT support expert at a church. Analyze this support ticket and provide actionable recommendations.

Ticket Details:
- Subject: ${ticket.subject}
- Description: ${ticket.description}
- Category: ${ticket.category}
- Priority: ${ticket.priority}
- Building: ${ticket.building || 'Not specified'}
- Room: ${ticket.room_number || 'Not specified'}
- Status: ${ticket.status}
- Created: ${ticket.created_date}
${ticket.comments?.length > 0 ? `- Recent activity: ${ticket.comments.slice(-3).map(c => c.content).join(' | ')}` : ''}

Provide your analysis in this exact JSON format:
{
  "summary": "One sentence summary of the issue",
  "root_cause": "Likely root cause of the problem",
  "recommended_actions": [
    {"action": "Specific action to take", "priority": "high/medium/low", "assignee_type": "technician/requester/vendor"},
    {"action": "Another action", "priority": "high/medium/low", "assignee_type": "technician/requester/vendor"}
  ],
  "estimated_resolution_time": "e.g., 30 minutes, 2 hours, 1 day",
  "parts_or_resources_needed": ["item1", "item2"],
  "follow_up_questions": ["Question to ask requester if needed"]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            root_cause: { type: "string" },
            recommended_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  priority: { type: "string" },
                  assignee_type: { type: "string" }
                }
              }
            },
            estimated_resolution_time: { type: "string" },
            parts_or_resources_needed: { type: "array", items: { type: "string" } },
            follow_up_questions: { type: "array", items: { type: "string" } }
          }
        }
      });
      
      setAiRecommendations(response);
      toast.success('AI analysis complete');
    } catch (error) {
      console.error('Error scanning ticket:', error);
      toast.error('Failed to analyze ticket');
    } finally {
      setScanningTicket(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFiles(true);
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
      const updatedAttachments = [...(ticket.attachments || []), ...uploadedFiles];
      
      await base44.entities.Ticket.update(ticketId, {
        attachments: updatedAttachments,
        last_activity_at: new Date().toISOString()
      });
      
      setTicket({ ...ticket, attachments: updatedAttachments });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploadingFiles(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!ticket) return null;

  const canEdit = isAdmin || isWorker || ticket.requester_email === user?.email;
  const canManage = isAdmin || isWorker;
  const slaBreached = ticket.time_to_first_response && ticket.time_to_first_response > 60;

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('SupportTickets'))}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <TicketIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 flex-shrink-0" />
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{ticket.subject}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm text-slate-600 font-mono">{ticket.ticket_number}</p>
                {getSourceBadge(ticket.source || 'manual_request')}
              </div>
            </div>
          </div>
          
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content - 2/3 width */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Ticket Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <p className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap">{ticket.description}</p>

                  {/* AI Scan Button */}
                  {canManage && !aiRecommendations && (
                    <Button
                      onClick={handleAIScan}
                      disabled={scanningTicket}
                      variant="outline"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {scanningTicket ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing Ticket...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI Scan & Recommend Actions
                        </>
                      )}
                    </Button>
                  )}

                  {/* AI Recommendations Panel */}
                  {aiRecommendations && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-2 border-purple-200 rounded-lg bg-purple-50 p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          AI Analysis
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAiRecommendations(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-purple-700 uppercase">Summary</p>
                          <p className="text-sm text-slate-700">{aiRecommendations.summary}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-purple-700 uppercase">Likely Root Cause</p>
                          <p className="text-sm text-slate-700">{aiRecommendations.root_cause}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Recommended Actions</p>
                          <div className="space-y-2">
                            {aiRecommendations.recommended_actions?.map((action, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-white rounded p-2 border border-purple-100">
                                <Badge className={
                                  action.priority === 'high' ? 'bg-red-100 text-red-700' :
                                  action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }>
                                  {action.priority}
                                </Badge>
                                <div className="flex-1">
                                  <p className="text-sm text-slate-800">{action.action}</p>
                                  <p className="text-xs text-slate-500">Assign to: {action.assignee_type}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-purple-700 uppercase">Est. Resolution</p>
                            <p className="text-sm text-slate-700">{aiRecommendations.estimated_resolution_time}</p>
                          </div>
                          {aiRecommendations.parts_or_resources_needed?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-purple-700 uppercase">Parts/Resources</p>
                              <div className="flex flex-wrap gap-1">
                                {aiRecommendations.parts_or_resources_needed.map((item, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {aiRecommendations.follow_up_questions?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Follow-up Questions</p>
                            <ul className="text-sm text-slate-700 list-disc list-inside">
                              {aiRecommendations.follow_up_questions.map((q, idx) => (
                                <li key={idx}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <Button
                          onClick={handleAIScan}
                          variant="ghost"
                          size="sm"
                          className="text-purple-600"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Re-scan
                        </Button>
                      </div>
                    </motion.div>
                  )}

                {/* Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-2">Attachments</p>
                    <div className="space-y-2">
                      {ticket.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                        >
                          <Paperclip className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload More Files */}
                {canEdit && (
                  <div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload-detail"
                    />
                    <label htmlFor="file-upload-detail">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingFiles}
                        className="cursor-pointer w-full sm:w-auto"
                        asChild
                      >
                        <span>
                          {uploadingFiles ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Paperclip className="w-4 h-4 mr-2" />
                              Add Files
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Suggested Solution */}
            {ticket.suggested_solution && (
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900 text-base sm:text-lg">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                    AI Suggested Solution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap">{ticket.suggested_solution}</p>
                </CardContent>
              </Card>
            )}

            {/* AI Draft Response */}
            <AnimatePresence>
              {showAIDraft && aiDraftResponse && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-blue-900 text-base sm:text-lg">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                          AI Draft Response
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAIDraft(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap">{aiDraftResponse}</p>
                      <Button
                        onClick={handleUseAIDraft}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        Use This Draft
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Activity Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  Activity Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {(() => {
                    // Build activity feed from all sources
                    const activities = [];

                    // Ticket created
                    activities.push({
                      type: 'created',
                      timestamp: ticket.created_date,
                      actor: ticket.requester_name || ticket.requester_email,
                      details: `Ticket created via ${ticket.source || 'web form'}`
                    });

                    // Comments
                    if (ticket.comments) {
                      ticket.comments.forEach((comment, idx) => {
                        activities.push({
                          type: comment.is_internal ? 'internal_note' : 'comment',
                          timestamp: comment.timestamp,
                          actor: comment.author_name || comment.author_email,
                          details: comment.content,
                          is_internal: comment.is_internal
                        });
                      });
                    }

                    // Status changes (resolved, archived)
                    if (ticket.resolved_at) {
                      activities.push({
                        type: 'status_change',
                        timestamp: ticket.resolved_at,
                        actor: 'System',
                        details: 'Ticket marked as resolved'
                      });
                    }

                    if (ticket.archived_at) {
                      activities.push({
                        type: 'status_change',
                        timestamp: ticket.archived_at,
                        actor: 'System',
                        details: 'Ticket archived'
                      });
                    }

                    // Sort by timestamp ascending
                    activities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                    const getActivityIcon = (type) => {
                      switch (type) {
                        case 'created': return <TicketIcon className="w-3 h-3 text-green-600" />;
                        case 'comment': return <MessageSquare className="w-3 h-3 text-blue-600" />;
                        case 'internal_note': return <AlertCircle className="w-3 h-3 text-amber-600" />;
                        case 'status_change': return <CheckCircle2 className="w-3 h-3 text-purple-600" />;
                        case 'email_sent': return <Mail className="w-3 h-3 text-cyan-600" />;
                        default: return <Clock className="w-3 h-3 text-slate-500" />;
                      }
                    };

                    const getActivityColor = (type) => {
                      switch (type) {
                        case 'created': return 'border-l-green-500 bg-green-50';
                        case 'comment': return 'border-l-blue-500 bg-blue-50';
                        case 'internal_note': return 'border-l-amber-500 bg-amber-50';
                        case 'status_change': return 'border-l-purple-500 bg-purple-50';
                        case 'email_sent': return 'border-l-cyan-500 bg-cyan-50';
                        default: return 'border-l-slate-300 bg-slate-50';
                      }
                    };

                    return activities.map((activity, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-3 rounded-lg border-l-4 ${getActivityColor(activity.type)}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-slate-900">{activity.actor}</span>
                              {activity.is_internal && (
                                <Badge variant="outline" className="text-xs bg-amber-100">Internal</Badge>
                              )}
                              <span className="text-xs text-slate-500">
                                {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">
                              {activity.details}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
                  <div ref={commentsEndRef} />
                </div>

                {/* Add Comment */}
                {canEdit && (
                  <div className="space-y-2">
                    {canManage && (
                      <div className="flex gap-2 mb-2">
                        <Button
                          onClick={() => handleGenerateAIResponse('response')}
                          disabled={generatingAI}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          {generatingAI ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2" />
                          )}
                          Draft Response
                        </Button>
                        <Button
                          onClick={() => handleGenerateAIResponse('solution')}
                          disabled={generatingAI}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          {generatingAI ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2" />
                          )}
                          Draft Solution
                        </Button>
                      </div>
                    )}
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      {isAdmin && (
                        <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={(e) => setIsInternalComment(e.target.checked)}
                            className="rounded"
                          />
                          Internal note (not visible to requester)
                        </label>
                      )}
                      <div className="flex-1" />
                      <Button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || submittingComment}
                        className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
                        size="sm"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Add Comment
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-4 sm:space-y-6">
            {/* Status & Priority */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm sm:text-base">Ticket Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Status</label>
                  {canManage ? (
                    <Select 
                      value={ticket.status} 
                      onValueChange={handleStatusChange}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="awaiting_information">Awaiting Information</SelectItem>
                        <SelectItem value="awaiting_parts">Awaiting Parts</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status?.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Category</label>
                  {canManage ? (
                    <Select 
                      value={ticket.category} 
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">
                      {ticket.category?.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Priority</label>
                  {canManage ? (
                    <Select 
                      value={ticket.priority} 
                      onValueChange={handlePriorityChange}
                    >
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
                  ) : (
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                    </Badge>
                  )}
                </div>

                <div>
                                        <label className="text-sm font-medium text-slate-600 mb-2 block">Due Date</label>
                                        {canManage ? (
                                          <div className="flex gap-2">
                                            <Input
                                              type="date"
                                              value={dueDateValue}
                                              onChange={(e) => setDueDateValue(e.target.value)}
                                              className="text-sm flex-1"
                                              disabled={updatingDueDate}
                                            />
                                            <Button
                                              size="sm"
                                              onClick={() => {
                                                if (dueDateValue) {
                                                  handleDueDateChange(dueDateValue);
                                                }
                                              }}
                                              disabled={updatingDueDate || !dueDateValue}
                                              className="bg-amber-600 hover:bg-amber-700"
                                            >
                                              {updatingDueDate ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                'Save'
                                              )}
                                            </Button>
                                          </div>
                                        ) : (
                                          ticket.due_date ? (
                                            <p className="text-sm text-slate-900">
                                              {format(new Date(ticket.due_date.split('T')[0] + 'T12:00:00'), 'MMM d, yyyy')}
                                            </p>
                                          ) : (
                                            <p className="text-sm text-slate-500">Not set</p>
                                          )
                                        )}
                                      </div>

                {canManage && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Assigned To</label>
                    <Select 
                      value={ticket.assigned_to || "unassigned"} 
                      onValueChange={handleAssignment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {staffMembers.map(staff => (
                          <SelectItem key={staff.email} value={staff.email}>
                            {staff.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!canManage && ticket.assigned_to_name && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-2 block">Assigned To</label>
                    <p className="text-sm text-slate-900">{ticket.assigned_to_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Requester Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm sm:text-base">Requester</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-900">{ticket.requester_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${ticket.requester_email}`} className="text-sm text-blue-600 hover:underline">
                    {ticket.requester_email}
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">Location</CardTitle>
                  {canManage && !editingLocation && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEditLocation}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingLocation ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Building</label>
                      <Input
                        value={tempBuilding}
                        onChange={(e) => setTempBuilding(e.target.value)}
                        placeholder="Enter building"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Room Number</label>
                      <Input
                        value={tempRoomNumber}
                        onChange={(e) => setTempRoomNumber(e.target.value)}
                        placeholder="Enter room number"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveLocation}
                        size="sm"
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingLocation(false)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Building</p>
                      <p className="text-sm text-slate-900 capitalize">{ticket.building?.replace('_', ' ') || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Room</p>
                      <p className="text-sm text-slate-900">{ticket.room_number || 'Not set'}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Metrics */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm sm:text-base">Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600">First Response</span>
                    </div>
                    {ticket.time_to_first_response ? (
                      <Badge variant="outline" className={slaBreached ? 'border-red-300 text-red-700' : ''}>
                        {Math.round(ticket.time_to_first_response)} min
                        {slaBreached && <AlertCircle className="w-3 h-3 ml-1 inline" />}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>

                  {ticket.time_to_resolution && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Resolution Time</span>
                      </div>
                      <Badge variant="outline">
                        {Math.round(ticket.time_to_resolution)} min
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600">Created</span>
                    </div>
                    <span className="text-xs text-slate-600">
                      {format(new Date(ticket.created_date), 'MMM d, h:mm a')}
                    </span>
                  </div>

                  {ticket.resolved_at && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-slate-600">Resolved</span>
                      </div>
                      <span className="text-xs text-slate-600">
                        {format(new Date(ticket.resolved_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ticket <strong>{ticket.ticket_number}</strong> - "{ticket.subject}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Ticket'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}