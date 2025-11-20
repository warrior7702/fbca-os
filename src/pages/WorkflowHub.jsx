import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  MessageSquare,
  Loader2,
  ArrowLeft,
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  TrendingUp,
  Crown,
  ListChecks
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";

const statusStages = [
  { value: "minister_goal_review", label: "Minister Review", color: "bg-purple-100 text-purple-700" },
  { value: "project_review", label: "Project Review", color: "bg-orange-100 text-orange-700" },
  { value: "campaign_running", label: "Campaign Running", color: "bg-green-100 text-green-700" },
  { value: "completed", label: "Completed", color: "bg-slate-100 text-slate-700" }
];

export default function WorkflowHub() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [viewMode, setViewMode] = useState("kanban");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState("requests");
  const [myTasks, setMyTasks] = useState([]);
  const [calendarWeekStart, setCalendarWeekStart] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState(null);

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

      const myRequestsData = await base44.entities.WorkflowRequest.filter({
        requestor_email: currentUser.email
      });
      setMyRequests(myRequestsData);

      const assignedData = await base44.entities.WorkflowRequest.filter({
        assigned_to: currentUser.email
      });
      setAssignedToMe(assignedData);

      if (adminStatus) {
        const allData = await base44.entities.WorkflowRequest.list('-created_date');
        setAllRequests(allData);
      }

      // Load all tasks from all active requests
      const allActiveRequests = await base44.entities.WorkflowRequest.filter({
        status: { $ne: 'completed' }
      });
      
      const allTasks = [];
      allActiveRequests.forEach(request => {
        // Check goal_review_data for tasks
        if (request.goal_review_data?.tasks) {
          request.goal_review_data.tasks.forEach(task => {
            allTasks.push({
              ...task,
              request_id: request.id,
              request_title: request.title,
              request_number: request.request_number,
              request_status: request.status
            });
          });
        }
        
        // Check project_review_data for tasks
        if (request.project_review_data?.tasks) {
          request.project_review_data.tasks.forEach(task => {
            allTasks.push({
              ...task,
              request_id: request.id,
              request_title: request.title,
              request_number: request.request_number,
              request_status: request.status
            });
          });
        }
        
        // Check campaign_data for tasks
        if (request.campaign_data?.tasks) {
          request.campaign_data.tasks.forEach(task => {
            allTasks.push({
              ...task,
              request_id: request.id,
              request_title: request.title,
              request_number: request.request_number,
              request_status: request.status
            });
          });
        }
      });
      
      setMyTasks(allTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke('scheduledMysteryResourceSync');
      
      if (result.data.success) {
        toast.success(`Sync complete! ${result.data.new_requests_created || 0} new requests created`);
        loadData();
      } else {
        toast.error('Sync failed: ' + (result.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status) => {
    const stage = statusStages.find(s => s.value === status);
    return stage?.color || "bg-slate-100 text-slate-700";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-blue-100 text-blue-700"
    };
    return colors[priority] || colors.medium;
  };

  const formatStatus = (status) => {
    const stage = statusStages.find(s => s.value === status);
    return stage?.label || status;
  };

  const getRequestsByStatus = (requests, status) => {
    return requests.filter(req => req.status === status);
  };

  const handleDelete = async (e, requestId) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) {
      return;
    }

    try {
      await base44.entities.WorkflowRequest.delete(requestId);
      toast.success('Request deleted');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete request');
    }
  };

  const KanbanCard = ({ request }) => {
    const handleClick = () => {
      if (isAdmin && request.status === 'project_review') {
        navigate(createPageUrl('ProjectReview') + `?id=${request.id}`);
      } else if (request.status === 'campaign_running') {
        navigate(createPageUrl('CampaignRunning') + `?id=${request.id}`);
      } else {
        navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`);
      }
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileHover={{ scale: 1.02 }}
      >
      <Card className="cursor-pointer hover:shadow-lg transition-all mb-3 group relative">
        <CardContent className="p-4" onClick={handleClick}>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm text-slate-900 line-clamp-2">
                {request.title}
              </h3>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={getPriorityColor(request.priority)}>
                  {request.priority}
                </Badge>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(e, request.id)}
                  >
                    <XCircle className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            
            <p className="text-xs text-slate-500">
              {request.request_number}
            </p>
            
            {request.ministry_department && (
              <Badge variant="secondary" className="text-xs">
                {request.ministry_department}
              </Badge>
            )}
            
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarIcon className="w-3 h-3" />
              {format(new Date(request.created_date), 'MMM d')}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
    );
  };

  const RequestCard = ({ request }) => {
    const handleClick = () => {
      if (isAdmin && request.status === 'project_review') {
        navigate(createPageUrl('ProjectReview') + `?id=${request.id}`);
      } else if (request.status === 'campaign_running') {
        navigate(createPageUrl('CampaignRunning') + `?id=${request.id}`);
      } else {
        navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
      >
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all group"
          onClick={handleClick}
        >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{request.title}</h3>
              </div>
              
              <p className="text-sm text-slate-500">
                {request.request_number} • {request.ministry_department}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Badge className={getStatusColor(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
                <Badge variant="outline" className={getPriorityColor(request.priority)}>
                  {request.priority}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarIcon className="w-3 h-3" />
                Created {format(new Date(request.created_date), 'MMM d, yyyy')}
              </div>
            </div>
            
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(e, request.id)}
              >
                <XCircle className="w-5 h-5 text-red-500" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

  const KanbanView = ({ requests }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statusStages.map(stage => {
        const stageRequests = getRequestsByStatus(requests, stage.value);
        return (
          <div key={stage.value} className="space-y-3">
            <div className="sticky top-0 bg-slate-50 p-3 rounded-lg border-2 border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-slate-700">
                  {stage.label}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {stageRequests.length}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <AnimatePresence>
                {stageRequests.map(request => (
                  <KanbanCard key={request.id} request={request} />
                ))}
              </AnimatePresence>
              
              {stageRequests.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No requests
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const displayRequests = isAdmin ? allRequests : [...myRequests, ...assignedToMe];
  const uniqueRequests = Array.from(new Map(displayRequests.map(r => [r.id, r])).values());
  
  const filteredRequests = showArchived 
    ? uniqueRequests.filter(r => r.status === 'completed')
    : uniqueRequests.filter(r => r.status !== 'completed');

  const stats = {
    total: uniqueRequests.length,
    minister_review: uniqueRequests.filter(r => r.status === 'minister_goal_review').length,
    project_review: uniqueRequests.filter(r => r.status === 'project_review').length,
    campaign_running: uniqueRequests.filter(r => r.status === 'campaign_running').length,
    completed: uniqueRequests.filter(r => r.status === 'completed').length
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6 overflow-auto pb-20">
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
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Communications Requests
                  {isAdmin && (
                    <Crown className={`inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {isAdmin ? 'All workflow requests' : 'Your requests and assignments'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <div className="hidden sm:flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                  <Button
                    variant={viewMode === "kanban" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  className="gap-2 hidden sm:flex"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  Sync PCO
                </Button>
              </>
            )}
            
            <Button
              onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Request</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="requests">
              <MessageSquare className="w-4 h-4 mr-2" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ListChecks className="w-4 h-4 mr-2" />
              Tasks ({myTasks.length})
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
            {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setShowArchived(false)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.total}</p>
                  </div>
                  <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setShowArchived(false)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Minister Review</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-700">{stats.minister_review}</p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setShowArchived(false)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Project Review</p>
                    <p className="text-xl sm:text-2xl font-bold text-orange-700">{stats.project_review}</p>
                  </div>
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setShowArchived(false)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Campaign Running</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.campaign_running}</p>
                  </div>
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all border-2 border-slate-300"
              onClick={() => setShowArchived(!showArchived)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-600">Completed</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-700">{stats.completed}</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isAdmin && !showArchived && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="gap-2 flex-shrink-0"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban View</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2 flex-shrink-0"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar View</span>
            </Button>
          </div>
        )}

        {showArchived ? (
          <Card>
            <CardHeader className="border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-600" />
                  Completed Plans (Archive)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchived(false)}
                >
                  ← Back to Active Plans
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No completed plans yet</p>
                  </div>
                ) : (
                  filteredRequests.map(request => (
                    <RequestCard key={request.id} request={request} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : isAdmin && viewMode === "kanban" ? (
          <KanbanView requests={filteredRequests} />
        ) : isAdmin && viewMode === "calendar" ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Calendar View Coming Soon
              </h3>
              <p className="text-slate-600 mb-4">
                Interactive calendar with drag-and-drop task scheduling will be available soon
              </p>
              <Button
                variant="outline"
                onClick={() => setViewMode("kanban")}
              >
                Back to Kanban View
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Requests Yet
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Start your first communications request to get started
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </div>
        )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-purple-600" />
                  All Communication Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListChecks className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No tasks in active requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTasks.map((task, index) => (
                      <motion.div
                        key={`${task.request_id}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-white rounded-lg border hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate(createPageUrl('WorkflowDetail') + `?id=${task.request_id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {task.request_number}
                              </Badge>
                              <Badge className={getStatusColor(task.request_status)}>
                                {formatStatus(task.request_status)}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-slate-900 mb-1">
                              {task.title || task.name || 'Untitled Task'}
                            </h3>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm text-slate-600">
                                From: {task.request_title}
                              </p>
                              {task.assigned_to && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <p className="text-sm text-slate-500">
                                    Assigned to: {task.assigned_to}
                                  </p>
                                </>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            {task.due_date && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                          {task.status && (
                            <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                              {task.status}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-purple-600" />
                    Task Calendar
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarWeekStart(subWeeks(calendarWeekStart, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarWeekStart(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarWeekStart(addWeeks(calendarWeekStart, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No tasks to display</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }, (_, i) => {
                      const day = addDays(startOfWeek(calendarWeekStart), i);
                      const dayTasks = myTasks.filter(task => 
                        task.due_date && isSameDay(new Date(task.due_date), day)
                      );
                      const isToday = isSameDay(day, new Date());

                      return (
                        <div
                          key={i}
                          className={`min-h-64 rounded-lg border-2 p-3 ${
                            isToday ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200'
                          }`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                            e.preventDefault();
                            if (!draggedTask) return;

                            const newDueDate = day.toISOString().split('T')[0];
                            
                            try {
                              // Find the request and update the task
                              const request = await base44.entities.WorkflowRequest.filter({
                                id: draggedTask.request_id
                              });
                              
                              if (request.length > 0) {
                                const req = request[0];
                                let updated = false;

                                // Update in goal_review_data
                                if (req.goal_review_data?.tasks) {
                                  req.goal_review_data.tasks = req.goal_review_data.tasks.map(t => 
                                    t === draggedTask ? { ...t, due_date: newDueDate } : t
                                  );
                                  updated = true;
                                }

                                // Update in project_review_data
                                if (req.project_review_data?.tasks) {
                                  req.project_review_data.tasks = req.project_review_data.tasks.map(t =>
                                    t === draggedTask ? { ...t, due_date: newDueDate } : t
                                  );
                                  updated = true;
                                }

                                // Update in campaign_data
                                if (req.campaign_data?.tasks) {
                                  req.campaign_data.tasks = req.campaign_data.tasks.map(t =>
                                    t === draggedTask ? { ...t, due_date: newDueDate } : t
                                  );
                                  updated = true;
                                }

                                if (updated) {
                                  await base44.entities.WorkflowRequest.update(req.id, {
                                    goal_review_data: req.goal_review_data,
                                    project_review_data: req.project_review_data,
                                    campaign_data: req.campaign_data
                                  });
                                  
                                  toast.success('Task date updated');
                                  loadData();
                                }
                              }
                            } catch (error) {
                              console.error('Error updating task:', error);
                              toast.error('Failed to update task date');
                            }
                            
                            setDraggedTask(null);
                          }}
                        >
                          <div className="text-center mb-3">
                            <p className="text-xs font-semibold text-slate-500">
                              {format(day, 'EEE')}
                            </p>
                            <p className={`text-lg font-bold ${isToday ? 'text-purple-600' : 'text-slate-900'}`}>
                              {format(day, 'd')}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(day, 'MMM')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {dayTasks.map((task, idx) => (
                              <motion.div
                                key={`${task.request_id}-${idx}`}
                                draggable
                                onDragStart={() => setDraggedTask(task)}
                                onDragEnd={() => setDraggedTask(null)}
                                whileHover={{ scale: 1.02 }}
                                className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg cursor-move shadow-sm hover:shadow-md transition-all"
                              >
                                <p className="text-xs font-semibold line-clamp-2 mb-1">
                                  {task.title || task.name || 'Untitled'}
                                </p>
                                <p className="text-[10px] opacity-90 truncate">
                                  {task.request_number}
                                </p>
                                {task.assigned_to && (
                                  <p className="text-[10px] opacity-75 truncate mt-1">
                                    {task.assigned_to.split('@')[0]}
                                  </p>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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