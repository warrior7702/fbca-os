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
  Clock,
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
  ExternalLink
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

      const tickets = await base44.entities.Ticket.filter({ id: ticketId });
      if (tickets && tickets.length > 0) {
        setTicket(tickets[0]);
        
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

      // Load staff members for assignment
      if (adminStatus) {
        const staff = await base44.entities.StaffContact.list();
        setStaffMembers(staff);
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

      // Send email notification to requester (unless internal comment)
      if (!isInternalComment) {
        try {
          await base44.functions.invoke('sendTicketNotification', {
            ticket_id: ticketId,
            notification_type: 'comment_added',
            comment: comment.content
          });
        } catch (emailError) {
          console.warn('Email notification failed:', emailError);
        }
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

      if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      await base44.entities.Ticket.update(ticketId, updateData);
      setTicket({ ...ticket, ...updateData });
      toast.success(`Ticket ${newStatus}`);

      // Send notification
      try {
        await base44.functions.invoke('sendTicketNotification', {
          ticket_id: ticketId,
          notification_type: 'status_changed',
          new_status: newStatus
        });
      } catch (emailError) {
        console.warn('Email notification failed:', emailError);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!ticket) return null;

  const canEdit = isAdmin || ticket.requester_email === user?.email;
  const slaBreached = ticket.time_to_first_response && ticket.time_to_first_response > 60;

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('SupportTickets'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TicketIcon className="w-6 h-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
              </div>
              <p className="text-sm text-slate-600 font-mono">{ticket.ticket_number}</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Details */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>

                {/* Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Attachments</p>
                    <div className="space-y-2">
                      {ticket.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <Paperclip className="w-4 h-4" />
                          {file.name}
                          <ExternalLink className="w-3 h-3" />
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
                        className="cursor-pointer"
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
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    AI Suggested Solution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">{ticket.suggested_solution}</p>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Discussion ({ticket.comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                  <AnimatePresence>
                    {ticket.comments && ticket.comments.map((comment, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg ${
                          comment.is_internal 
                            ? 'bg-amber-50 border-2 border-amber-200' 
                            : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-slate-900">{comment.author_name}</p>
                              {comment.is_internal && (
                                <Badge variant="outline" className="text-xs">Internal</Badge>
                              )}
                              <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={commentsEndRef} />
                </div>

                {/* Add Comment */}
                {canEdit && (
                  <div className="space-y-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      {isAdmin && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
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
                        className="bg-amber-600 hover:bg-amber-700"
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
          <div className="space-y-6">
            {/* Status & Priority */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ticket Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Status</label>
                  {isAdmin ? (
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
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status?.replace('_', ' ')}
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">Priority</label>
                  {isAdmin ? (
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
                      {ticket.priority}
                    </Badge>
                  )}
                </div>

                {isAdmin && (
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

                {ticket.assigned_to_name && !isAdmin && (
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
                <CardTitle className="text-base">Requester</CardTitle>
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
                <CardTitle className="text-base">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-slate-600">Building</p>
                  <p className="text-sm text-slate-900 capitalize">{ticket.building?.replace('_', ' ')}</p>
                </div>
                {ticket.room_number && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Room</p>
                    <p className="text-sm text-slate-900">{ticket.room_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metrics */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Metrics</CardTitle>
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
    </div>
  );
}