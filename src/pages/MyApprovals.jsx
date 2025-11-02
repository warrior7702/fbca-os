
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin, // Added
  User, // Added
  XCircle, // Added
  Building2, // Added
  Users, // Added
  FileText // Added
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns"; // Fixed syntax
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning"; // Retained

export default function MyApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null); // Reordered
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false); // Retained
  const [viewMode, setViewMode] = useState('list');
  const [answerPreviews, setAnswerPreviews] = useState({}); // Renamed from approvalsWithAnswers
  const [sentCodes, setSentCodes] = useState(() => {
    // Load sent codes from localStorage on mount
    const saved = localStorage.getItem('sentDoorCodes');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
    if (approvals.length > 0) {
      loadAllAnswerPreviews();
    }
  }, [approvals]);

  // Persist sentCodes to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sentDoorCodes', JSON.stringify(sentCodes));
  }, [sentCodes]);

  // Auto-sync when page becomes visible again (e.g., returning from PCO tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !syncing) {
        console.log('👁️ Page became visible - auto-syncing...');
        handleSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncing]);

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
    // Only load previews for the first few approvals to avoid rate limits
    for (const approval of approvals.slice(0, 10)) { 
      if (!answerPreviews[approval.request_id]) { // Changed from approvalsWithAnswers
        loadAnswerPreview(approval);
      }
    }
  };

  const loadAnswerPreview = async (approval) => {
    // loadingAnswers state and its usage are removed as per new outline
    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      if (response.data?.answers && Object.keys(response.data.answers).length > 0) {
        const answeredQuestions = response.data.questions
          .filter(q => response.data.answers[q.id])
          .map(q => ({
            question: q.question,
            answer: response.data.answers[q.id]
          }));

        setAnswerPreviews(prev => ({ // Changed from setApprovalsWithAnswers
          ...prev,
          [approval.request_id]: answeredQuestions
        }));
      }
    } catch (error) {
      console.error('Error loading answer preview:', error);
    }
    // setLoadingAnswers and its usage are removed as per new outline
  };

  // handleCardholderSelect and handleSendCodeToPCO functions removed as per new outline (related states removed)

  const handleApprove = async (approval, formData = null) => {
    try {
      console.log('🔍 Attempting to approve:', approval.request_id);
      
      let response;
      
      if (formData) {
        response = await base44.functions.invoke('approveWithClickUpTask', {
          request_id: approval.request_id,
          approval: approval,
          form_data: formData
        });
      } else {
        console.log('📞 Calling approveResourceRequest...');
        response = await base44.functions.invoke('approveResourceRequest', {
          request_id: approval.request_id,
          action: 'approve',
          note: `Approved via FBCA OS by ${user?.full_name || user?.email}`
        });
        console.log('✅ Function response:', response.data);
      }

      if (response.data.ok || response.data.success) {
        toast.success('Approved successfully!');
        await handleSync();
      } else {
        console.error('❌ Approval failed:', response.data);
        toast.error(response.data.error || 'Failed to approve');
      }
    } catch (error) {
      console.error('❌ Full approval error:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleDeny = async (approval) => {
    try {
      console.log('🔍 Attempting to deny:', approval.request_id);
      
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id,
        action: 'deny',
        note: `Denied via FBCA OS by ${user?.full_name || user?.email}`
      });

      if (response.data.ok) {
        toast.success('Request denied');
        await handleSync();
      } else {
        console.error('❌ Denial failed:', response.data);
        toast.error(response.data.error || 'Failed to deny');
      }
    } catch (error) {
      console.error('❌ Denial error:', error);
      toast.error(error.response?.data?.error || 'Failed to deny request');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncMyApprovals');
      
      if (response.data.success) {
        toast.success(`Synced ${response.data.count} pending approval${response.data.count !== 1 ? 's' : ''}`);
        setApprovals(response.data.pending_approvals || []);
        setAnswerPreviews({}); // Changed from setApprovalsWithAnswers
        // expandedPreviews and selectedCardholders states were removed, so their set functions are removed here
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewDetails = async (approval) => {
    setSelectedApproval(approval);
    setShowDetailModal(true);
  };

  // toggleExpandPreview function removed as expandedPreviews state was removed

  const handleModalClose = () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
  };

  const handleApprovalSuccess = async () => {
    await loadApprovals();
    handleModalClose(); 
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
    <div className="h-full bg-gradient-to-br from-orange-50 to-red-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
              <p className="text-slate-600">
                {approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg shadow-sm border border-slate-200">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={viewMode === 'calendar' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Calendar
              </Button>
            </div>

            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync from PCO
                </>
              )}
            </Button>
          </div>
        </div>

        {!user?.pco_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {/* Open in Planning Center - List View (Retained) */}
        {viewMode === 'list' && (
          <div className="mb-6">
            <a 
              href="https://calendar.planningcenteronline.com/approvals"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button 
                variant="outline" 
                className="w-full border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Planning Center (Approve There)
              </Button>
            </a>
            <p className="text-xs text-slate-500 mt-2 text-center">
              If you have trouble approving here, use this link to approve directly in PCO
            </p>
          </div>
        )}

        {viewMode === 'calendar' && approvals.length > 0 && (
          <ApprovalCalendar 
            approvals={approvals} 
            onApprovalClick={handleViewDetails}
          />
        )}

        {viewMode === 'list' && (
          <div className="grid gap-4">
            <AnimatePresence>
              {approvals.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    All caught up!
                  </h3>
                  <p className="text-slate-600">No pending approvals at this time.</p>
                </motion.div>
              ) : (
                approvals.map((approval, index) => {
                  const answerPreview = answerPreviews[approval.request_id]; // Changed from approvalsWithAnswers
                  // loadingPreview and isExpanded states were removed
                  // selectedCardholder, savingCode, codeSent states were removed
                  
                  return (
                    <motion.div
                      key={approval.request_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:shadow-lg transition-all border-l-4 border-l-orange-500">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-slate-900 text-lg">
                                  {approval.event_name}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                  {approval.approval_status === 'P' ? 'Pending' : approval.approval_status}
                                </Badge>
                              </div>

                              <div className="space-y-1 text-sm text-slate-600 mb-3">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>
                                    {approval.event_starts_at 
                                      ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                                      : 'Date not set'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4" /> {/* Changed from Box */}
                                  <span>{approval.resource_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" /> {/* Changed from Clock */}
                                  <span className="text-xs text-slate-500">
                                    Group: {approval.approval_group_name}
                                  </span>
                                </div>
                              </div>

                              {/* loadingPreview was removed */}
                              
                              {answerPreview && answerPreview.length > 0 && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">Request Details:</p>
                                  <div className="space-y-1">
                                    {/* isExpanded logic removed, now shows all answers */}
                                    {answerPreview.map((qa, idx) => (
                                      <div key={idx} className="text-xs">
                                        <span className="text-slate-600">{qa.question}:</span>
                                        <span className="ml-1 text-slate-800 font-medium">{qa.answer}</span>
                                      </div>
                                    ))}
                                    {/* Toggle button removed */}
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={() => handleViewDetails(approval)}
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              <FileText className="w-4 h-4 mr-1" /> {/* Changed from Eye */}
                              Details
                            </Button>
                          </div>

                          {/* Door Code Assignment section removed as per new outline */}
                          {/* CardholderLookup component and related state/logic removed */}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ApprovalDetailModal
        approval={selectedApproval}
        open={showDetailModal}
        onClose={handleModalClose}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}
