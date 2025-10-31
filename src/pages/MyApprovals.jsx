import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck,
  ExternalLink,
  Calendar,
  Package,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [approvalsWithAnswers, setApprovalsWithAnswers] = useState({});
  const [expandedPreviews, setExpandedPreviews] = useState({});

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadApprovedRequests();
    }
  }, [viewMode]);

  useEffect(() => {
    if (approvals.length > 0) {
      loadAllAnswerPreviews();
    }
  }, [approvals]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadApprovals = async () => {
    try {
      const response = await base44.functions.invoke('getMyPendingApprovals');
      setApprovals(response.data.pending_approvals || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadAllAnswerPreviews = async () => {
    const answersMap = {};
    
    for (const approval of approvals.slice(0, 5)) {
      const preview = await loadAnswerPreview(approval);
      if (preview && preview.answers && Object.keys(preview.answers).length > 0) {
        answersMap[approval.request_id] = preview;
      }
    }
    
    setApprovalsWithAnswers(answersMap);
  };

  const loadAnswerPreview = async (approval) => {
    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      if (response.data.ok && response.data.answers && Object.keys(response.data.answers).length > 0) {
        return {
          questions: response.data.questions || [],
          answers: response.data.answers || {}
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading answer preview:', error);
      return null;
    }
  };

  const handleApprove = async (approval, formData = null) => {
    try {
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id,
        formData: formData
      });

      if (response.data.success) {
        toast.success('Request approved!');
        loadApprovals();
      } else {
        toast.error(response.data.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve request');
    }
  };

  const handleDeny = async () => {
    if (!selectedApproval) return;

    try {
      const response = await base44.functions.invoke('denyResourceRequest', {
        request_id: selectedApproval.request_id
      });

      if (response.data.success) {
        toast.success('Request denied');
        setShowDetailModal(false);
        loadApprovals();
      } else {
        toast.error(response.data.error || 'Failed to deny request');
      }
    } catch (error) {
      console.error('Deny error:', error);
      toast.error('Failed to deny request');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const pendingResponse = await base44.functions.invoke('syncMyApprovals');
      
      if (pendingResponse.data.success) {
        toast.success(`Synced ${pendingResponse.data.count} pending approval${pendingResponse.data.count !== 1 ? 's' : ''}`);
        setApprovals(pendingResponse.data.pending_approvals || []);
        setApprovalsWithAnswers({}); 
        setExpandedPreviews({});
      }
      
      const approvedResponse = await base44.functions.invoke('syncMyApprovedRequests');
      
      if (approvedResponse.data.success) {
        toast.success(`Synced ${approvedResponse.data.count} approved request${approvedResponse.data.count !== 1 ? 's' : ''}`);
        setApprovedRequests(approvedResponse.data.approved_requests || []);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewDetails = (approval) => {
    console.log('👁️ Opening details for:', approval);
    setSelectedApproval(approval);
    setShowDetailModal(true);
  };

  const toggleExpandPreview = (requestId) => {
    setExpandedPreviews(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const openPCOApprovalsPage = () => {
    window.open('https://calendar.planningcenteronline.com/approvals', '_blank', 'noopener,noreferrer');
  };

  const loadApprovedRequests = async () => {
    setLoadingApproved(true);
    try {
      console.log('🔄 Loading approved requests...');
      const response = await base44.functions.invoke('getMyApprovedRequests');
      console.log('✅ Approved requests response:', response.data);
      setApprovedRequests(response.data.approved_requests || []);
      toast.success(`Loaded ${response.data.count} approved request${response.data.count !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('❌ Error loading approved requests:', error);
      toast.error('Failed to load approved requests');
    } finally {
      setLoadingApproved(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-amber-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
              <p className="text-slate-600">Manage resource requests</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={openPCOApprovalsPage}
              variant="outline"
              className="border-orange-300 hover:bg-orange-50 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in PCO
            </Button>
            
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync from PCO
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            onClick={() => setViewMode('list')}
            variant={viewMode === 'list' ? 'default' : 'outline'}
            className={viewMode === 'list' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 hover:bg-orange-50'}
          >
            Pending
            {approvals.length > 0 && (
              <Badge className="ml-2 bg-white text-orange-600">
                {approvals.length}
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={() => setViewMode('calendar')}
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            className={viewMode === 'calendar' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 hover:bg-orange-50'}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Approved
          </Button>
        </div>

        {!user?.pco_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {viewMode === 'calendar' && (
          loadingApproved ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <p className="text-slate-600 ml-3">Loading approved requests...</p>
            </div>
          ) : (
            <ApprovalCalendar 
              approvals={approvedRequests} 
              onApprovalClick={handleViewDetails}
            />
          )
        )}

        {viewMode === 'list' && (
          <>
            {/* Open Planning Center Button */}
            <div className="mb-6">
              <Button
                onClick={openPCOApprovalsPage}
                variant="outline"
                className="w-full border-orange-300 hover:bg-orange-50 gap-2 py-6"
              >
                <ExternalLink className="w-5 h-5" />
                Open Planning Center Approvals Page
              </Button>
            </div>

            {/* Approvals List */}
            {approvals.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">All caught up!</h3>
                  <p className="text-slate-600 text-center">
                    No pending approvals at the moment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {approvals.map((approval, idx) => {
                  const answerData = approvalsWithAnswers[approval.request_id];
                  const hasAnswers = answerData && Object.keys(answerData.answers).length > 0;
                  const isExpanded = expandedPreviews[approval.request_id];
                  
                  return (
                    <motion.div
                      key={approval.request_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-lg">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-start gap-3 mb-3">
                                <h3 className="text-xl font-bold text-slate-900 flex-1">
                                  {approval.event_name}
                                </h3>
                                <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                                  {approval.resource_name}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>
                                  <p className="text-slate-500 mb-1">Event Date:</p>
                                  <p className="font-medium text-slate-900">
                                    {approval.event_starts_at
                                      ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                                      : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">Requested:</p>
                                  <p className="font-medium text-slate-900">
                                    {approval.pco_created_at
                                      ? format(new Date(approval.pco_created_at), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">Resource:</p>
                                  <p className="font-medium text-slate-900">{approval.resource_name}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">Quantity:</p>
                                  <p className="font-medium text-slate-900">{approval.quantity || 1}</p>
                                </div>
                              </div>

                              {hasAnswers && (
                                <div className="mb-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpandPreview(approval.request_id)}
                                    className="text-orange-600 hover:text-orange-700 p-0 h-auto"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-4 h-4 mr-1" />
                                        Hide Additional Info
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-4 h-4 mr-1" />
                                        Show Additional Info ({Object.keys(answerData.answers).length} field{Object.keys(answerData.answers).length !== 1 ? 's' : ''})
                                      </>
                                    )}
                                  </Button>

                                  {isExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                                    >
                                      <div className="space-y-3">
                                        {answerData.questions.map((question) => {
                                          const answer = answerData.answers[question.id];
                                          if (!answer) return null;
                                          
                                          return (
                                            <div key={question.id}>
                                              <p className="text-sm font-medium text-slate-700 mb-1">
                                                {question.question}
                                              </p>
                                              <p className="text-sm text-slate-900">{answer}</p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <Button
                                  onClick={() => handleViewDetails(approval)}
                                  variant="outline"
                                  className="border-orange-300 hover:bg-orange-50"
                                >
                                  View Details
                                </Button>
                                
                                <Button
                                  onClick={() => handleApprove(approval)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ApprovalDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        approval={selectedApproval}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </div>
  );
}