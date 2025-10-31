import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, ExternalLink, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";

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

  const loadApprovedRequests = async () => {
    setLoadingApproved(true);
    try {
      console.log('🔄 Loading approved requests from database...');
      const response = await base44.functions.invoke('getMyApprovedRequests');
      console.log('✅ Approved requests response:', response.data);
      setApprovedRequests(response.data.approved_requests || []);
      
      if (response.data.count === 0) {
        toast.info('No approved requests found. Click "Sync from PCO" to load them.', {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('❌ Error loading approved requests:', error);
      toast.error('Failed to load approved requests');
    } finally {
      setLoadingApproved(false);
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
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id,
        form_data: formData
      });

      if (response.data.ok) {
        toast.success(`Approved ${approval.event_name}`);
        await handleSync();
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve request');
    }
  };

  const handleDeny = async () => {
    try {
      const response = await base44.functions.invoke('denyResourceRequest', {
        request_id: selectedApproval.request_id
      });

      if (response.data.ok) {
        toast.success(`Denied ${selectedApproval.event_name}`);
        setShowDetailModal(false);
        await handleSync();
      }
    } catch (error) {
      console.error('Deny error:', error);
      toast.error('Failed to deny request');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Starting full sync...');
      
      // Sync pending approvals
      const pendingResponse = await base44.functions.invoke('syncMyApprovals');
      console.log('✅ Pending sync response:', pendingResponse.data);
      
      if (pendingResponse.data.success) {
        toast.success(`Synced ${pendingResponse.data.count} pending approval${pendingResponse.data.count !== 1 ? 's' : ''}`);
        setApprovals(pendingResponse.data.pending_approvals || []);
        setApprovalsWithAnswers({}); 
        setExpandedPreviews({});
      }
      
      // Sync approved requests
      console.log('🔄 Starting approved sync...');
      const approvedResponse = await base44.functions.invoke('syncMyApprovedRequests');
      console.log('✅ Approved sync response:', approvedResponse.data);
      
      if (approvedResponse.data.success) {
        toast.success(`Synced ${approvedResponse.data.count} approved request${approvedResponse.data.count !== 1 ? 's' : ''}`);
        setApprovedRequests(approvedResponse.data.approved_requests || []);
      }
      
      console.log('✅ Full sync complete!');
    } catch (error) {
      console.error('❌ Sync error:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to sync approvals. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewDetails = (approval) => {
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
        
        {/* Header with tabs */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">My Approvals</h1>
            <p className="text-slate-600">
              {viewMode === 'list' 
                ? `${approvals.length} approval${approvals.length !== 1 ? 's' : ''} pending your review`
                : `${approvedRequests.length} approved request${approvedRequests.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg shadow p-1 gap-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                Pending
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={viewMode === 'calendar' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                Approved
              </Button>
            </div>

            <Button
              onClick={handleSync}
              disabled={syncing || !user?.pco_access_token}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing ? 'Syncing...' : 'Sync from PCO'}
            </Button>
          </div>
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
          ) : approvedRequests.length === 0 ? (
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Approved Requests Yet</h3>
                <p className="text-slate-600 mb-4">
                  Click "Sync from PCO" above to load your approved requests from Planning Center.
                </p>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </CardContent>
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
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={openPCOApprovalsPage}
                className="gap-2 border-orange-300 hover:bg-orange-50"
              >
                <ExternalLink className="w-4 h-4" />
                Open Planning Center
              </Button>
            </div>

            {approvals.length === 0 ? (
              <Card className="border-2 border-slate-200">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                  <p className="text-slate-600">No pending approvals at the moment.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {approvals.map((approval) => {
                  const preview = approvalsWithAnswers[approval.request_id];
                  const isExpanded = expandedPreviews[approval.request_id];
                  const hasAnswers = preview && Object.keys(preview.answers || {}).length > 0;

                  return (
                    <motion.div
                      key={approval.request_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group"
                    >
                      <Card className="border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg transition-all cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-2">{approval.event_name}</CardTitle>
                              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                                <Badge variant="outline" className="border-orange-300">
                                  {approval.resource_name}
                                </Badge>
                                <Badge variant="outline" className="border-blue-300">
                                  {format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')}
                                </Badge>
                                <Badge variant="outline" className="border-purple-300">
                                  {approval.approval_group_name}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent>
                          {hasAnswers && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-slate-700">Request Details</h4>
                                {Object.keys(preview.answers).length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandPreview(approval.request_id);
                                    }}
                                    className="text-xs"
                                  >
                                    {isExpanded ? 'Show Less' : 'Show All'}
                                  </Button>
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                {preview.questions
                                  .filter(q => preview.answers[q.id])
                                  .slice(0, isExpanded ? undefined : 2)
                                  .map((question) => (
                                    <div key={question.id} className="text-sm">
                                      <span className="font-medium text-slate-700">{question.question}:</span>{' '}
                                      <span className="text-slate-600">{preview.answers[question.id]}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <Button
                              onClick={() => handleViewDetails(approval)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              View Details
                            </Button>
                            <Button
                              onClick={() => handleApprove(approval)}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Quick Approve
                            </Button>
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