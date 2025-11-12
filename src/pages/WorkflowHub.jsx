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
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  TrendingUp,
  Crown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

const statusStages = [
  { value: "request", label: "Request", color: "bg-blue-100 text-blue-700" },
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

  const KanbanCard = ({ request }) => {
    // Admin/super_user clicking on project_review goes to ProjectReview page
    const handleClick = () => {
      if (isAdmin && request.status === 'project_review') {
        navigate(createPageUrl('ProjectReview') + `?id=${request.id}`);
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
        onClick={handleClick}
      >
      <Card className="cursor-pointer hover:shadow-lg transition-all mb-3">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm text-slate-900 line-clamp-2">
                {request.title}
              </h3>
              <Badge variant="outline" className={getPriorityColor(request.priority)}>
                {request.priority}
              </Badge>
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
              <Calendar className="w-3 h-3" />
              {format(new Date(request.created_date), 'MMM d')}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const RequestCard = ({ request }) => {
    // Admin/super_user clicking on project_review goes to ProjectReview page
    const handleClick = () => {
      if (isAdmin && request.status === 'project_review') {
        navigate(createPageUrl('ProjectReview') + `?id=${request.id}`);
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
          className="cursor-pointer hover:shadow-lg transition-all"
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
                <Calendar className="w-3 h-3" />
                Created {format(new Date(request.created_date), 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const KanbanView = ({ requests }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

  const stats = {
    total: uniqueRequests.length,
    pending: uniqueRequests.filter(r => r.status === 'minister_goal_review').length,
    active: uniqueRequests.filter(r => ['project_review', 'campaign_running'].includes(r.status)).length,
    completed: uniqueRequests.filter(r => r.status === 'completed').length
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 p-6 overflow-auto">
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
              <MessageSquare className="w-6 h-6 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Communications Requests
                  {isAdmin && (
                    <Crown className={`inline-block ml-2 w-5 h-5 ${user?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
                  )}
                </h1>
                <p className="text-sm text-slate-600">
                  {isAdmin ? 'All workflow requests' : 'Your requests and assignments'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
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
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  Sync PCO
                </Button>
              </>
            )}
            
            <Button
              onClick={() => navigate(createPageUrl('CommunicationsRequestForm'))}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </div>
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
                  <MessageSquare className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Pending Review</p>
                    <p className="text-2xl font-bold text-purple-700">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">In Progress</p>
                    <p className="text-2xl font-bold text-orange-700">{stats.active}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Completed</p>
                    <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isAdmin && viewMode === "kanban" ? (
          <KanbanView requests={uniqueRequests} />
        ) : (
          <div className="grid gap-4">
            {uniqueRequests.length === 0 ? (
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
              uniqueRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}