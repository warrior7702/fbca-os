import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AppHeader from "@/components/shared/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Plus,
  Loader2,
  RefreshCw,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Users,
  ArrowRight,
  FileText,
  Target,
  Presentation,
  Megaphone,
  Edit,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  Building2,
  Archive
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function WorkflowHub() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [view, setView] = useState('requestor');
  const [viewMode, setViewMode] = useState('kanban');
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Check if user is admin
      const adminCheck = currentUser.role === 'admin';
      setIsAdmin(adminCheck);

      // Load my requests (as requestor) - for regular users, exclude completed/cancelled
      const myReqsQuery = adminCheck 
        ? { requestor_email: currentUser.email }
        : { 
            requestor_email: currentUser.email,
            status: { $nin: ['completed', 'cancelled'] }
          };
      
      const myReqs = await base44.entities.WorkflowRequest.filter(myReqsQuery, '-created_date');
      setMyRequests(myReqs);

      if (adminCheck) {
        // If admin, load assigned requests and all requests
        const assignedReqs = await base44.entities.WorkflowRequest.filter({
          assigned_to: currentUser.email
        }, '-created_date');
        setAssignedToMe(assignedReqs);

        const allReqs = await base44.entities.WorkflowRequest.list('-created_date', 100);
        setAllRequests(allReqs);
        
        // Default to worker view for admins
        setView('worker');
      } else {
        // Regular users don't need these
        setAssignedToMe([]);
        setAllRequests([]);
        setView('requestor');
      }

    } catch (error) {
      console.error('Error loading workflow data:', error);
      toast.error('Failed to load communications requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('monitorMysteryResource');

      if (response.data.new_requests_created > 0) {
        toast.success(`Created ${response.data.new_requests_created} new request(s) from PCO`);
      } else {
        toast.info('No new Mystery Resource requests found');
      }

      await loadData();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync with PCO Calendar');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditExisting = () => {
    if (!selectedRequestId) {
      toast.error('Please select a request to edit');
      return;
    }
    navigate(createPageUrl('WorkflowDetail') + `?id=${selectedRequestId}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'minister_goal_review': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'project_review': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'campaign_running': return 'bg-green-100 text-green-700 border-green-300';
      case 'completed': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'minister_goal_review': return <Target className="w-4 h-4" />;
      case 'project_review': return <Presentation className="w-4 h-4" />;
      case 'campaign_running': return <Megaphone className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const formatStatus = (status) => {
    const statusMap = {
      'minister_goal_review': 'Minister Goal Review',
      'project_review': 'Project Review',
      'campaign_running': 'Campaign Running',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  const getRequestsByStatus = (requests, status) => {
    return requests.filter(r => r.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading Communications Requests...</p>
        </div>
      </div>
    );
  }

  const KanbanCard = ({ request }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer p-4 mb-3"
      onClick={() => navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight flex-1">{request.title}</h3>
          <Badge variant="outline" className={`${getStatusColor(request.status)} text-xs ml-2`}>
            {formatStatus(request.status).split(' ')[0]}
          </Badge>
        </div>

        {request.requestor_name && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <User className="w-3 h-3" />
            <span className="truncate">{request.requestor_name}</span>
          </div>
        )}

        {request.ministry_department && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{request.ministry_department}</span>
          </div>
        )}

        {request.pco_event_date && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CalendarIcon className="w-3 h-3" />
            <span>{format(new Date(request.pco_event_date), 'MMM d, yyyy')}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
            <span className="text-xs text-slate-500">{request.request_number}</span>
          </div>
          {request.type === 'mystery_resource' && (
            <Sparkles className="w-3 h-3 text-purple-500" />
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs h-7"
          onClick={(e) => {
            e.stopPropagation();
            navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`);
          }}
        >
          {request.status === 'minister_goal_review' ? 'Start Goal Review' : 
           request.status === 'project_review' ? 'Review Project' : 
           'View Campaign'}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </motion.div>
  );

  const RequestCard = ({ request, showAssignee = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-slate-200 hover:shadow-lg transition-all cursor-pointer"
      onClick={() => navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-slate-500">{request.request_number}</span>
              <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
              {request.type === 'mystery_resource' && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Auto-created
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{request.title}</h3>
            {request.ministry_department && (
              <p className="text-xs text-slate-500 mb-1">📋 {request.ministry_department}</p>
            )}
            {request.pco_event_date && (
              <p className="text-xs text-slate-500 mb-1">
                📅 Event: {format(new Date(request.pco_event_date), 'MMM d, yyyy')}
              </p>
            )}
            <p className="text-sm text-slate-600 line-clamp-2">{request.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline" className={getStatusColor(request.status)}>
            {getStatusIcon(request.status)}
            <span className="ml-1">{formatStatus(request.status)}</span>
          </Badge>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            {request.conversation_history && request.conversation_history.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {request.conversation_history.length}
              </span>
            )}
            <span>{formatDistanceToNow(new Date(request.created_date), { addSuffix: true })}</span>
          </div>
        </div>

        {showAssignee && request.assigned_to_name && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <User className="w-3 h-3" />
              <span>Assigned: {request.assigned_to_name}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  const KanbanView = ({ requests }) => {
    const goalReviewRequests = getRequestsByStatus(requests, 'minister_goal_review');
    const projectReviewRequests = getRequestsByStatus(requests, 'project_review');
    const campaignRunningRequests = getRequestsByStatus(requests, 'campaign_running');
    const completedRequests = getRequestsByStatus(requests, 'completed');

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-50/50 rounded-lg p-4 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-slate-900">Minister Goal Review</h3>
            </div>
            <Badge className="bg-purple-100 text-purple-700">{goalReviewRequests.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {goalReviewRequests.map(request => (
              <KanbanCard key={request.id} request={request} />
            ))}
            {goalReviewRequests.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No requests in goal review
              </div>
            )}
          </div>
        </div>

        <div className="bg-orange-50/50 rounded-lg p-4 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Presentation className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-slate-900">Project Review</h3>
            </div>
            <Badge className="bg-orange-100 text-orange-700">{projectReviewRequests.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {projectReviewRequests.map(request => (
              <KanbanCard key={request.id} request={request} />
            ))}
            {projectReviewRequests.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No requests in project review
              </div>
            )}
          </div>
        </div>

        <div className="bg-green-50/50 rounded-lg p-4 border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-slate-900">Campaign Running</h3>
            </div>
            <Badge className="bg-green-100 text-green-700">{campaignRunningRequests.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {campaignRunningRequests.map(request => (
              <KanbanCard key={request.id} request={request} />
            ))}
            {campaignRunningRequests.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No active campaigns
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50/50 rounded-lg p-4 border-2 border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Archived</h3>
            </div>
            <Badge className="bg-slate-100 text-slate-700">{completedRequests.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {completedRequests.map(request => (
              <KanbanCard key={request.id} request={request} />
            ))}
            {completedRequests.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No archived requests
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const allActiveRequests = view === 'worker' ? allRequests : myRequests;

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <AppHeader
          icon={MessageSquare}
          title="Communications Request"
          description={isAdmin ? "Track all creative projects" : "Your communication requests"}
          iconColor="from-purple-500 to-pink-500"
          action={
            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync PCO
                    </>
                  )}
                </Button>
              )}
              
              <div className="flex gap-2 items-center">
                <Select
                  value={selectedRequestId}
                  onValueChange={setSelectedRequestId}
                >
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select request..." />
                  </SelectTrigger>
                  <SelectContent>
                    {myRequests.map(req => (
                      <SelectItem key={req.id} value={req.id}>
                        {req.request_number} - {req.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleEditExisting}
                  disabled={!selectedRequestId}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Existing Plan
                </Button>
              </div>
              
              <Button
                onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Communication Plan
              </Button>
            </div>
          }
        />

        {/* Stats Cards - ADMIN ONLY */}
        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <LayoutGrid className="w-5 h-5 text-slate-600" />
                  <Badge className="bg-slate-100 text-slate-700">{allActiveRequests.length}</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{allActiveRequests.length}</p>
                <p className="text-sm text-slate-600">Total Requests</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 bg-purple-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <Badge className="bg-purple-100 text-purple-700">
                    {getRequestsByStatus(allActiveRequests, 'minister_goal_review').length}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {getRequestsByStatus(allActiveRequests, 'minister_goal_review').length}
                </p>
                <p className="text-sm text-slate-600">Goal Review</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Megaphone className="w-5 h-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-700">
                    {getRequestsByStatus(allActiveRequests, 'campaign_running').length}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {getRequestsByStatus(allActiveRequests, 'campaign_running').length}
                </p>
                <p className="text-sm text-slate-600">Campaign Running</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-600" />
                  <Badge className="bg-slate-100 text-slate-700">
                    {getRequestsByStatus(allActiveRequests, 'completed').length}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {getRequestsByStatus(allActiveRequests, 'completed').length}
                </p>
                <p className="text-sm text-slate-600">Archived</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Toggle - ADMIN ONLY */}
        {isAdmin && (
          <div className="flex items-center justify-between">
            <Tabs value={view} onValueChange={setView} className="w-auto">
              <TabsList>
                <TabsTrigger value="requestor">
                  <User className="w-4 h-4 mr-2" />
                  My Requests
                </TabsTrigger>
                <TabsTrigger value="worker">
                  <Users className="w-4 h-4 mr-2" />
                  Team View
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
              <TabsList>
                <TabsTrigger value="kanban">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Kanban View
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="w-4 h-4 mr-2" />
                  List View
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Main Content */}
        {isAdmin ? (
          viewMode === 'kanban' ? (
            <KanbanView requests={allActiveRequests} />
          ) : (
            <div>
              {allActiveRequests.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No requests yet</h3>
                    <p className="text-slate-600 mb-4">Create your first communications request</p>
                    <Button onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Request
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allActiveRequests.map(request => (
                    <RequestCard key={request.id} request={request} showAssignee={view === 'worker'} />
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          // Regular user view - simple card grid, only open requests
          <div>
            {myRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No open requests</h3>
                  <p className="text-slate-600 mb-4">Create a new communications request to get started</p>
                  <Button onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myRequests.map(request => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}