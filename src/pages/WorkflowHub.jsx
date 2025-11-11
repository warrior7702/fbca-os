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
  Workflow,
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
  MessageSquare,
  FileText
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
  const [view, setView] = useState('requestor'); // 'requestor' or 'worker'
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Determine user role - check if they're a comm director or worker
      const isWorker = currentUser.role === 'admin' || 
                      currentUser.email.toLowerCase().includes('comm') ||
                      currentUser.email.toLowerCase().includes('director');

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
      toast.error('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Monitor for Mystery Resource requests
      const response = await base44.functions.invoke('monitorMysteryResource');
      
      if (response.data.new_workflows_created > 0) {
        toast.success(`Found ${response.data.new_workflows_created} new Mystery Resource request(s)`);
      } else {
        toast.info('No new Mystery Resource requests found');
      }

      await loadData();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync with PCO');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'intake': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ai_review': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'comm_director_review': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'completed': return 'bg-green-100 text-green-700 border-green-300';
      case 'cancelled': return 'bg-slate-100 text-slate-700 border-slate-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'intake': return <Sparkles className="w-4 h-4" />;
      case 'ai_review': return <Sparkles className="w-4 h-4" />;
      case 'comm_director_review': return <ClipboardList className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
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
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading Workflow Hub...</p>
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
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{request.title}</h3>
            <p className="text-sm text-slate-600 line-clamp-2">{request.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(request.status)}>
              {getStatusIcon(request.status)}
              <span className="ml-1">{formatStatus(request.status)}</span>
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {request.type.replace('_', ' ')}
            </Badge>
          </div>

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
              <span>Assigned to: {request.assigned_to_name}</span>
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
          icon={Workflow}
          title="Workflow Hub"
          description="Manage requests, workflows, and work orders"
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
                onClick={() => navigate(createPageUrl('NewWorkflowRequest'))}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </div>
          }
        />

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
                <Users className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-700">{assignedToMe.length}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{assignedToMe.length}</p>
              <p className="text-sm text-slate-600">Assigned to Me</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <Badge className="bg-orange-100 text-orange-700">
                  {[...myRequests, ...assignedToMe].filter(r => 
                    ['intake', 'ai_review', 'comm_director_review'].includes(r.status)
                  ).length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {[...myRequests, ...assignedToMe].filter(r => 
                  ['intake', 'ai_review', 'comm_director_review'].includes(r.status)
                ).length}
              </p>
              <p className="text-sm text-slate-600">Pending Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-700">
                  {[...myRequests, ...assignedToMe].filter(r => r.status === 'completed').length}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {[...myRequests, ...assignedToMe].filter(r => r.status === 'completed').length}
              </p>
              <p className="text-sm text-slate-600">Completed</p>
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
              Work Queue
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
                    <p className="text-slate-600 mb-4">Start by creating a new request or syncing with PCO</p>
                    <Button onClick={() => navigate(createPageUrl('NewWorkflowRequest'))}>
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
                    <p className="text-slate-600">Tasks assigned to you will appear here</p>
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