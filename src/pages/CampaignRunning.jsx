import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Calendar as CalendarIcon,
  FileText,
  Link as LinkIcon,
  Briefcase,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function CampaignRunning() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('id');
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);

  useEffect(() => {
    if (requestId) {
      loadRequest();
      loadWorkOrders();
    }
  }, [requestId]);

  const loadRequest = async () => {
    setLoading(true);
    try {
      const req = await base44.entities.WorkflowRequest.filter({ id: requestId });
      if (req && req.length > 0) {
        setRequest(req[0]);
      } else {
        toast.error('Request not found');
        navigate(createPageUrl('WorkflowHub'));
      }
    } catch (error) {
      console.error('Error loading request:', error);
      toast.error('Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrders = async () => {
    try {
      const tickets = await base44.entities.Ticket.filter({
        source: 'communications_workflow'
      });
      
      const relatedTickets = tickets.filter(t => 
        t.comments?.some(c => c.content?.includes(requestId))
      );
      
      setWorkOrders(relatedTickets);
    } catch (error) {
      console.error('Error loading work orders:', error);
    }
  };

  const toggleTaskComplete = async (taskId) => {
    const ticket = workOrders.find(t => t.id === taskId);
    if (!ticket) return;

    const newStatus = ticket.status === 'resolved' ? 'open' : 'resolved';
    
    try {
      await base44.entities.Ticket.update(taskId, {
        status: newStatus,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null
      });
      
      await loadWorkOrders();
      toast.success(newStatus === 'resolved' ? 'Task completed!' : 'Task reopened');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await base44.entities.Ticket.update(ticketId, {
        status: newStatus
      });
      
      await loadWorkOrders();
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getTaskTypeColor = (category) => {
    const colors = {
      'marketing': 'bg-purple-100 text-purple-700',
      'av_production': 'bg-purple-100 text-purple-700',
      'technical': 'bg-blue-100 text-blue-700'
    };
    return colors[category] || 'bg-slate-100 text-slate-700';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'open': { label: 'Not Started', color: 'bg-slate-100 text-slate-700' },
      'in_progress': { label: 'In Progress', color: 'bg-orange-100 text-orange-700' },
      'resolved': { label: 'Complete', color: 'bg-green-100 text-green-700' },
      'closed': { label: 'Complete', color: 'bg-green-100 text-green-700' }
    };
    return badges[status] || badges.open;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const tasks = request.project_review_data?.tasks || [];
  const completedTasks = workOrders.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const totalTasks = workOrders.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('WorkflowHub'))}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">
              {request.title}
            </h1>
            <p className="text-sm text-slate-600">
              {request.requestor_name}
            </p>
          </div>

          <Badge className="bg-orange-100 text-orange-700">
            Campaign Running
          </Badge>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">PROJECT PROGRESS</span>
                <span className="font-bold text-purple-600">{progressPercentage}%</span>
              </div>
              
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{completedTasks} of {totalTasks} tasks complete</span>
                </div>
                {request.pco_event_date && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    <span>Event: {format(new Date(request.pco_event_date), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="calendar">Project Calendar</TabsTrigger>
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Project Tasks</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {workOrders.map((ticket) => {
                    const isComplete = ticket.status === 'resolved' || ticket.status === 'closed';
                    const statusBadge = getStatusBadge(ticket.status);
                    
                    return (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-4 p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
                      >
                        <Checkbox
                          checked={isComplete}
                          onCheckedChange={() => toggleTaskComplete(ticket.id)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className={`font-semibold text-slate-900 ${isComplete ? 'line-through' : ''}`}>
                              {ticket.subject}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={statusBadge.color}>
                                {statusBadge.label}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={async () => {
                                  await base44.entities.Ticket.delete(ticket.id);
                                  await loadWorkOrders();
                                  toast.success('Task deleted');
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                            <span>Due: {format(new Date(ticket.created_date), 'MMM d, yyyy')}</span>
                            <Badge variant="outline" className={getTaskTypeColor(ticket.category)}>
                              {ticket.category?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          
                          <div className="mt-2">
                            <span className="text-sm text-slate-700">{ticket.assigned_to_name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {workOrders.length === 0 && (
                    <div className="text-center py-12">
                      <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">No work orders created yet</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Work orders will appear here once the project is finalized
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Calendar Tab */}
          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardContent className="p-12 text-center">
                <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Calendar view coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Project Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {request.ministry_department && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Ministry</p>
                    <p className="text-sm font-medium text-slate-900">{request.ministry_department}</p>
                  </div>
                )}

                {request.project_review_data?.event_theme && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Theme</p>
                    <p className="text-sm text-slate-700">{request.project_review_data.event_theme}</p>
                  </div>
                )}

                {request.project_review_data?.expected_attendance && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Expected Attendance</p>
                    <p className="text-sm text-slate-700">{request.project_review_data.expected_attendance}</p>
                  </div>
                )}

                {request.project_review_data?.desired_impact && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Desired Impact</p>
                    <p className="text-sm text-slate-700">{request.project_review_data.desired_impact}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-purple-600" />
                  Project Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {request.project_review_data?.uploaded_materials?.length > 0 ? (
                  <div className="space-y-2">
                    {request.project_review_data.uploaded_materials.map((material, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900">{material.name}</p>
                          <p className="text-xs text-slate-500">
                            Uploaded {format(new Date(material.uploaded_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <LinkIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No resources uploaded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Work Orders Tab */}
          <TabsContent value="workorders" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                  Work Orders ({workOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {workOrders.length > 0 ? (
                  <div className="space-y-3">
                    {workOrders.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {ticket.ticket_number} • Created {format(new Date(ticket.created_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge className={getStatusBadge(ticket.status).color}>
                            {getStatusBadge(ticket.status).label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-700">
                            Assigned to: <strong>{ticket.assigned_to_name}</strong>
                          </span>
                          {ticket.category && (
                            <Badge variant="outline" className={getTaskTypeColor(ticket.category)}>
                              {ticket.category.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>

                        {ticket.description && (
                          <p className="text-sm text-slate-600 mt-3">{ticket.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No work orders yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}