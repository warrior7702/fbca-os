import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
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
  Box,
  Eye
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [approvalsWithAnswers, setApprovalsWithAnswers] = useState({});
  const [loadingAnswers, setLoadingAnswers] = useState({});
  const [expandedPreviews, setExpandedPreviews] = useState({});

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  // Load preview answers for each approval
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
    for (const approval of approvals.slice(0, 10)) {
      if (!approvalsWithAnswers[approval.request_id]) {
        loadAnswerPreview(approval);
      }
    }
  };

  const loadAnswerPreview = async (approval) => {
    setLoadingAnswers(prev => ({ ...prev, [approval.request_id]: true }));
    
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

        setApprovalsWithAnswers(prev => ({
          ...prev,
          [approval.request_id]: answeredQuestions
        }));
      }
    } catch (error) {
      console.error('Error loading answer preview:', error);
    } finally {
      setLoadingAnswers(prev => ({ ...prev, [approval.request_id]: false }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncMyApprovals');
      
      if (response.data.success) {
        toast.success(`Synced ${response.data.count} pending approvals`);
        setApprovals(response.data.pending_approvals || []);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
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

  const handleModalClose = () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
  };

  const handleApprovalSuccess = async () => {
    // Reload approvals after approve/deny
    await loadApprovals();
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
        {/* Header */}
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
            {/* View Mode Toggle */}
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

        {/* Connection Warning */}
        {!user?.pco_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && approvals.length > 0 && (
          <ApprovalCalendar 
            approvals={approvals} 
            onApprovalClick={handleViewDetails}
          />
        )}

        {/* List View */}
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
                  const answerPreview = approvalsWithAnswers[approval.request_id];
                  const loadingPreview = loadingAnswers[approval.request_id];
                  const isExpanded = expandedPreviews[approval.request_id];
                  
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
                          <div className="flex items-start justify-between">
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
                                  <Box className="w-4 h-4" />
                                  <span>{approval.resource_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span className="text-xs text-slate-500">
                                    Group: {approval.approval_group_name}
                                  </span>
                                </div>
                              </div>

                              {/* Answer Preview */}
                              {loadingPreview && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Loading details...</span>
                                </div>
                              )}
                              
                              {answerPreview && answerPreview.length > 0 && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">Request Details:</p>
                                  <div className="space-y-1">
                                    {(isExpanded ? answerPreview : answerPreview.slice(0, 2)).map((qa, idx) => (
                                      <div key={idx} className="text-xs">
                                        <span className="text-slate-600">{qa.question}:</span>
                                        <span className="ml-1 text-slate-800 font-medium">{qa.answer}</span>
                                      </div>
                                    ))}
                                    {answerPreview.length > 2 && (
                                      <button
                                        onClick={() => toggleExpandPreview(approval.request_id)}
                                        className="text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline cursor-pointer"
                                      >
                                        {isExpanded 
                                          ? '- Show less' 
                                          : `+${answerPreview.length - 2} more detail${answerPreview.length - 2 !== 1 ? 's' : ''}`
                                        }
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={() => handleViewDetails(approval)}
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Details
                            </Button>
                          </div>
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

      {/* Detail Modal */}
      <ApprovalDetailModal
        approval={selectedApproval}
        open={showDetailModal}
        onClose={handleModalClose}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}