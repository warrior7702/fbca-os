import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, Loader2, RefreshCw, Calendar, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [approvalsWithAnswers, setApprovalsWithAnswers] = useState({});
  const [expandedPreviews, setExpandedPreviews] = useState({});
  const [viewMode, setViewMode] = useState('list');

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
    for (const approval of approvals) {
      if (!approvalsWithAnswers[approval.request_id]) {
        await loadAnswerPreview(approval);
      }
    }
  };

  const loadAnswerPreview = async (approval) => {
    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      if (response.data.ok) {
        setApprovalsWithAnswers(prev => ({
          ...prev,
          [approval.request_id]: {
            questions: response.data.questions || [],
            answers: response.data.answers || {}
          }
        }));
      }
    } catch (error) {
      console.error('Error loading answer preview:', error);
    }
  };

  const handleApprove = async (approval, formData = null) => {
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });
      
      toast.success(`Approved: ${approval.event_name}`);
      
      setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Failed to approve request');
    }
  };

  const handleDeny = async () => {
    if (!selectedApproval) return;
    
    try {
      await base44.functions.invoke('denyResourceRequest', {
        request_id: selectedApproval.request_id
      });
      
      toast.success(`Denied: ${selectedApproval.event_name}`);
      
      setApprovals(prev => prev.filter(a => a.request_id !== selectedApproval.request_id));
      setShowDetailModal(false);
      setSelectedApproval(null);
    } catch (error) {
      console.error('Deny error:', error);
      toast.error('Failed to deny request');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Starting sync...');
      
      // Sync pending approvals
      console.log('📥 Syncing pending approvals...');
      const pendingResponse = await base44.functions.invoke('syncMyApprovals');
      console.log('✅ Pending response:', pendingResponse.data);
      
      if (pendingResponse.data.success) {
        toast.success(`Synced ${pendingResponse.data.count} pending approval${pendingResponse.data.count !== 1 ? 's' : ''}`);
        setApprovals(pendingResponse.data.pending_approvals || []);
        setApprovalsWithAnswers({}); 
        setExpandedPreviews({});
      }
      
      // Also sync approved requests
      console.log('📥 Syncing approved requests...');
      const approvedResponse = await base44.functions.invoke('syncMyApprovedRequests');
      console.log('✅ Approved response:', approvedResponse.data);
      
      if (approvedResponse.data.success) {
        toast.success(`Synced ${approvedResponse.data.count} approved request${approvedResponse.data.count !== 1 ? 's' : ''}`);
        setApprovedRequests(approvedResponse.data.approved_requests || []);
        
        // If in calendar view, trigger a reload
        if (viewMode === 'calendar') {
          await loadApprovedRequests();
        }
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
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
      console.log('🔄 Loading approved requests from database...');
      const response = await base44.functions.invoke('getMyApprovedRequests');
      console.log('✅ Approved requests response:', response.data);
      console.log('📊 Count:', response.data.count);
      console.log('📋 Requests:', response.data.approved_requests);
      setApprovedRequests(response.data.approved_requests || []);
      
      if (response.data.count === 0) {
        toast.info('No approved requests found. Click "Sync from PCO" to fetch them.');
      } else {
        toast.success(`Loaded ${response.data.count} approved request${response.data.count !== 1 ? 's' : ''}`);
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
              disabled={syncing || !user?.pco_access_token}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync from PCO
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="gap-2">
              Pending
              {approvals.length > 0 && (
                <Badge className="bg-orange-600 text-white">{approvals.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              Approved
              {approvedRequests.length > 0 && (
                <Badge className="bg-green-600 text-white">{approvedRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
          ) : approvedRequests.length === 0 ? (
            <Card className="p-12 text-center border-2 border-dashed border-orange-300">
              <Calendar className="w-16 h-16 text-orange-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Approved Requests</h3>
              <p className="text-slate-600 mb-4">Click "Sync from PCO" to load your approved requests</p>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </Button>
            </Card>
          ) : (
            <ApprovalCalendar 
              approvals={approvedRequests} 
              onApprovalClick={handleViewDetails}
            />
          )
        )}

        {viewMode === 'list' && (
          <>
            <Button
              onClick={openPCOApprovalsPage}
              variant="outline"
              className="mb-6 border-orange-300 hover:bg-orange-50 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Planning Center Approvals Page
            </Button>

            {approvals.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-orange-300">
                <ClipboardCheck className="w-16 h-16 text-orange-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Pending Approvals</h3>
                <p className="text-slate-600 mb-4">You're all caught up! No resource requests need your approval.</p>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  className="border-orange-300 hover:bg-orange-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Again
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {approvals.map((approval, index) => {
                    const answerData = approvalsWithAnswers[approval.request_id];
                    const isExpanded = expandedPreviews[approval.request_id];
                    const hasAnswers = answerData && Object.keys(answerData.answers || {}).length > 0;

                    return (
                      <motion.div
                        key={approval.request_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="hover:shadow-lg transition-all border-2 border-orange-200">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-xl font-bold text-slate-900">{approval.event_name}</h3>
                                  <Badge className="bg-orange-100 text-orange-700">
                                    {approval.approval_group_name}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 mb-3">
                                  <div>
                                    <span className="font-semibold">Resource:</span> {approval.resource_name}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Quantity:</span> {approval.quantity}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Event Date:</span>{' '}
                                    {approval.event_starts_at
                                      ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                                      : 'N/A'}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Requested:</span>{' '}
                                    {approval.pco_created_at
                                      ? format(new Date(approval.pco_created_at), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </div>
                                </div>

                                {hasAnswers && (
                                  <div className="mb-3">
                                    <button
                                      onClick={() => toggleExpandPreview(approval.request_id)}
                                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                                    >
                                      {isExpanded ? '▼ Hide' : '▶ Show'} Request Details ({Object.keys(answerData.answers).length})
                                    </button>
                                    
                                    {isExpanded && (
                                      <div className="mt-2 p-3 bg-orange-50 rounded-lg space-y-2">
                                        {answerData.questions.map((question) => {
                                          const answer = answerData.answers[question.id];
                                          if (!answer) return null;
                                          
                                          return (
                                            <div key={question.id} className="text-sm">
                                              <span className="font-semibold text-slate-700">{question.question}:</span>{' '}
                                              <span className="text-slate-600">{answer}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={() => handleViewDetails(approval)}
                                variant="outline"
                                className="flex-1 border-orange-300 hover:bg-orange-50"
                              >
                                View Details
                              </Button>
                              <Button
                                onClick={() => handleApprove(approval)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                Approve
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      <ApprovalDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedApproval(null);
        }}
        approval={selectedApproval}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </div>
  );
}