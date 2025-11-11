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
  Megaphone
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function WorkflowHub() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [view, setView] = useState('requestor');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Determine user role - check if they're a comm director or team member
      const isWorker = currentUser.role === 'admin' || 
                      currentUser.email.toLowerCase().includes('comm') ||
                      currentUser.email.toLowerCase().includes('director') ||
                      currentUser.email.toLowerCase().includes('marketing');

      setView(isWorker ? 'worker' : 'requestor');

      // Load my requests (as requestor)
      const myReqs = await base44.entities.WorkflowRequest.filter({
        requestor_email: currentUser.email
      }, '-created_date');
      setMyRequests(myReqs);

      // Load requests assigned to me (as worker)
      const assignedReqs = await base44.entities.WorkflowRequest.filter({
        assigned_to: currentUser.email
      }, '-created_date');
      setAssignedToMe(assignedReqs);

      // If admin/worker, load all requests
      if (isWorker) {
        const allReqs = await base44.entities.WorkflowRequest.list('-created_date', 50);
        setAllRequests(allReqs);
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
      // Monitor for Mystery Resource requests
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'request': return 'bg-blue-100 text-blue-700 border-blue-300';
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
      case 'request': return <FileText className="w-4 h-4" />;
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
      'request': 'Request',
      'minister_goal_review': 'Minister Goal Review',
      'project_review': 'Project Review',
      'campaign_running': 'Campaign Running',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
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

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={MessageSquare}
          title="Communications Request"
          description="Minister Goal Review → Project Review → Campaign Running"
          iconColor="from-purple-500 to-pink-500"
          action={
            <div className="flex gap-2">
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
              <Button
                onClick={() => navigate(createPageUrl('NewCommunicationRequest'))}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </div>
          }
        />

        {/* Entry Points Info */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">3 Ways to Create Requests</p>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>🔄 <strong>Auto:</strong> PCO Calendar events with "Mystery Resource"</p>
                  <p>📝 <strong>Manual Form:</strong> Submit directly through our form (coming soon)</p>
                  <p>💬 <strong>Continue Existing:</strong> Add to your current requests</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <User className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700">{myRequests.length}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{myRequests.length}</p>
              <p className="text-sm text-slate-600">My Requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-700">
                  {[...myRequests, ...assignedToMe].filter(r => r.status === 'minister_goal_review').length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {[...myRequests, ...assignedToMe].filter(r => r.status === 'minister_goal_review').length}
              </p>
              <p className="text-sm text-slate-600">Goal Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Presentation className="w-5 h-5 text-orange-600" />
                <Badge className="bg-orange-100 text-orange-700">
                  {[...myRequests, ...assignedToMe].filter(r => r.status === 'project_review').length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {[...myRequests, ...assignedToMe].filter(r => r.status === 'project_review').length}
              </p>
              <p className="text-sm text-slate-600">Project Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Megaphone className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-700">
                  {[...myRequests, ...assignedToMe].filter(r => r.status === 'campaign_running').length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {[...myRequests, ...assignedToMe].filter(r => r.status === 'campaign_running').length}
              </p>
              <p className="text-sm text-slate-600">Running</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={view} onValueChange={setView} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="requestor">
              <User className="w-4 h-4 mr-2" />
              My Requests
            </TabsTrigger>
            <TabsTrigger value="worker">
              <Users className="w-4 h-4 mr-2" />
              Team Queue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requestor" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">My Requests</h2>
              {myRequests.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No requests yet</h3>
                    <p className="text-slate-600 mb-4">Create your first communications request</p>
                    <Button onClick={() => navigate(createPageUrl('NewCommunicationRequest'))}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Request
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myRequests.map(request => (
                    <RequestCard key={request.id} request={request} showAssignee={true} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="worker" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Assigned to Me</h2>
              {assignedToMe.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No assigned tasks</h3>
                    <p className="text-slate-600">Requests assigned to you will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {assignedToMe.map(request => (
                    <RequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </div>

            {user?.role === 'admin' && allRequests.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">All Requests</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allRequests.map(request => (
                    <RequestCard key={request.id} request={request} showAssignee={true} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}