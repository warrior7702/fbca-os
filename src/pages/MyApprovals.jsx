
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
  CheckCircle2
}  from "lucide-react"; // ChevronDown, ChevronUp removed as they are no longer used
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState('pending');
  const [approvalsWithAnswers, setApprovalsWithAnswers] = useState({});
  const [approvedWithAnswers, setApprovedWithAnswers] = useState({});
  // `expandedPreviews` state removed as expand/collapse functionality is removed from card previews
  // const [expandedPreviews, setExpandedPreviews] = useState({});

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
    if (viewMode === 'approved') {
      loadApprovedRequests();
    }
  }, [viewMode]);

  useEffect(() => {
    if (approvals.length > 0) {
      loadAllAnswerPreviews();
    }
  }, [approvals]);

  useEffect(() => {
    if (approvedRequests.length > 0) {
      loadAllApprovedAnswerPreviews();
    }
  }, [approvedRequests]);

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
    
    for (const approval of approvals.slice(0, 10)) {
      const preview = await loadAnswerPreview(approval);
      if (preview && preview.answers && Object.keys(preview.answers).length > 0) {
        answersMap[approval.request_id] = preview;
      }
    }
    
    setApprovalsWithAnswers(answersMap);
  };

  const loadAllApprovedAnswerPreviews = async () => {
    const answersMap = {};
    
    for (const approval of approvedRequests.slice(0, 10)) {
      const preview = await loadAnswerPreview(approval);
      if (preview && preview.answers && Object.keys(preview.answers).length > 0) {
        answersMap[approval.request_id] = preview;
      }
    }
    
    setApprovedWithAnswers(answersMap);
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
        if (viewMode === 'approved') {
          loadApprovedRequests();
        }
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
      console.log('🔄 Starting sync...');
      
      const pendingResponse = await base44.functions.invoke('syncMyApprovals');
      console.log('📥 Pending response:', pendingResponse.data);
      
      if (pendingResponse.data.success) {
        toast.success(`Synced ${pendingResponse.data.count} pending approval${pendingResponse.data.count !== 1 ? 's' : ''}`);
        setApprovals(pendingResponse.data.pending_approvals || []);
        setApprovalsWithAnswers({}); 
        // `setExpandedPreviews({})` removed as `expandedPreviews` state is removed
      }
      
      console.log('🔄 Syncing approved requests...');
      const approvedResponse = await base44.functions.invoke('syncMyApprovedRequests');
      console.log('📥 Approved response:', approvedResponse.data);
      
      if (approvedResponse.data.success) {
        toast.success(`Synced ${approvedResponse.data.count} approved request${approvedResponse.data.count !== 1 ? 's' : ''}`);
        setApprovedRequests(approvedResponse.data.approved_requests || []);
        console.log('✅ Approved requests loaded:', approvedResponse.data.approved_requests?.length);
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

  // `toggleExpandPreview` function removed as expand/collapse functionality is removed from card previews
  // const toggleExpandPreview = (requestId) => {
  //   setExpandedPreviews(prev => ({
  //     ...prev,
  //     [requestId]: !prev[requestId]
  //   }));
  // };

  const openPCOApprovalsPage = () => {
    window.open('https://calendar.planningcenteronline.com/approvals', '_blank', 'noopener,noreferrer');
  };

  const loadApprovedRequests = async () => {
    setLoadingApproved(true);
    try {
      console.log('🔄 Loading approved requests from database...');
      const response = await base44.functions.invoke('getMyApprovedRequests');
      console.log('✅ Approved requests response:', response.data);
      console.log('📊 Count:', response.data.count);
      console.log('📊 Requests:', response.data.approved_requests);
      setApprovedRequests(response.data.approved_requests || []);
      if (response.data.count > 0) {
        toast.success(`Loaded ${response.data.count} approved request${response.data.count !== 1 ? 's' : ''}`);
      } else {
        toast.info('No approved requests found. Try syncing first!');
      }
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
            onClick={() => setViewMode('pending')}
            variant={viewMode === 'pending' ? 'default' : 'outline'}
            className={viewMode === 'pending' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 hover:bg-orange-50'}
          >
            Pending
            {approvals.length > 0 && (
              <Badge className="ml-2 bg-white text-orange-600">
                {approvals.length}
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={() => setViewMode('approved')}
            variant={viewMode === 'approved' ? 'default' : 'outline'}
            className={viewMode === 'approved' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 hover:bg-orange-50'}
          >
            Approved
            {approvedRequests.length > 0 && (
              <Badge className="ml-2 bg-white text-orange-600">
                {approvedRequests.length}
              </Badge>
            )}
          </Button>
        </div>

        {!user?.pco_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {/* PENDING VIEW */}
        {viewMode === 'pending' && (
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
                  // `isExpanded` is removed
                  
                  return (
                    <motion.div
                      key={approval.request_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-lg">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-slate-900">
                                  {approval.event_name}
                                </h3>
                                <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                                  Pending
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {approval.event_starts_at
                                    ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                                    : 'N/A'}
                                </div>
                              </div>

                              <div className="flex items-start gap-2 text-sm mb-3">
                                <Package className="w-4 h-4 text-orange-600 mt-0.5" />
                                <div>
                                  <span className="font-medium text-slate-700">{approval.resource_name}</span>
                                  {approval.quantity > 1 && (
                                    <span className="text-slate-500 ml-2">× {approval.quantity}</span>
                                  )}
                                </div>
                              </div>

                              {hasAnswers && (
                                <div className="mt-4 space-y-2">
                                  {answerData.questions.map((question) => {
                                    const answer = answerData.answers[question.id];
                                    if (!answer) return null;
                                    
                                    return (
                                      <div key={question.id} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-slate-600">{question.question}: </span>
                                          <span className="font-medium text-slate-900">{answer}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                onClick={() => handleViewDetails(approval)}
                                variant="outline"
                                size="sm"
                                className="border-orange-300 hover:bg-orange-50"
                              >
                                Details
                              </Button>
                              
                              <Button
                                onClick={() => handleApprove(approval)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Approve
                              </Button>
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

        {/* APPROVED VIEW */}
        {viewMode === 'approved' && (
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

            {loadingApproved ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <p className="text-slate-600 ml-3">Loading approved requests...</p>
              </div>
            ) : approvedRequests.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No approved requests yet</h3>
                  <p className="text-slate-600 text-center mb-4">
                    Click "Sync from PCO" to load your approved requests
                  </p>
                  <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {approvedRequests.map((approval, idx) => {
                  const answerData = approvedWithAnswers[approval.request_id];
                  const hasAnswers = answerData && Object.keys(answerData.answers).length > 0;
                  // `isExpanded` is removed
                  
                  return (
                    <motion.div
                      key={approval.request_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-slate-900">
                                  {approval.event_name}
                                </h3>
                                <Badge className="bg-green-100 text-green-700 border border-green-300">
                                  Approved
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {approval.event_starts_at
                                    ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                                    : 'N/A'}
                                </div>
                              </div>

                              <div className="flex items-start gap-2 text-sm mb-3">
                                <Package className="w-4 h-4 text-green-600 mt-0.5" />
                                <div>
                                  <span className="font-medium text-slate-700">{approval.resource_name}</span>
                                  {approval.quantity > 1 && (
                                    <span className="text-slate-500 ml-2">× {approval.quantity}</span>
                                  )}
                                </div>
                              </div>

                              {hasAnswers && (
                                <div className="mt-4 space-y-2">
                                  {answerData.questions.map((question) => {
                                    const answer = answerData.answers[question.id];
                                    if (!answer) return null;
                                    
                                    return (
                                      <div key={question.id} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-slate-600">{question.question}: </span>
                                          <span className="font-medium text-slate-900">{answer}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
