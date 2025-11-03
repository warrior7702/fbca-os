
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
  MapPin,
  User,
  XCircle,
  Building2,
  Users,
  FileText
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns"; // Added parseISO
// Removed: import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal"; -> Will re-add placeholder
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";
// Removed: import CardholderLookup from "../components/approvals/CardholderLookup"; // Added back -> Removed again

// Placeholder components - these would typically be imported from other files
// But for a self-contained, working example based on the outline, they are defined here.

const AppHeader = ({ icon: Icon, title, description, iconColor, action }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${iconColor}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-600">{description}</p>
      </div>
    </div>
    {action}
  </div>
);

// Placeholder for ApprovalDetailModal - Re-introduced based on outline usage
const ApprovalDetailModal = ({ approval, isOpen, onClose, onApprove, onDeny }) => {
  if (!isOpen || !approval) return null;

  const eventDate = approval.event_starts_at ? format(parseISO(approval.event_starts_at), 'MMM d, yyyy h:mm a') : 'Date not set';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{approval.event_name}</h2>
        <p className="text-slate-700 mb-2"><strong>Resource:</strong> {approval.resource_name}</p>
        <p className="text-slate-700 mb-2"><strong>Group:</strong> {approval.approval_group_name}</p>
        <p className="text-slate-700 mb-4"><strong>Date/Time:</strong> {eventDate}</p>

        {/* You might display more details here, possibly from `answerPreviews` if available */}
        {/* For now, just a placeholder message for additional details */}
        <p className="text-sm text-slate-600 mb-6">Additional request details would appear here.</p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={() => onDeny(approval)}>
            <XCircle className="w-4 h-4 mr-2" /> Deny
          </Button>
          <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => onApprove(approval)}>
            <CheckCircle className="w-4 h-4 mr-2" /> Approve
          </Button>
        </div>
      </div>
    </div>
  );
};

// Placeholder for ApprovalFormModal
const ApprovalFormModal = () => null;

// Placeholder for FullApprovalCalendarModal
const FullApprovalCalendarModal = ({ isOpen, onClose, approvals }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full h-[90vh] shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Approval Calendar</h2>
        <div className="flex-grow overflow-hidden">
          <ApprovalCalendar
            approvals={approvals}
            onApprovalClick={(approval) => {
              // Open in PCO instead of modal
              window.open(`https://calendar.planningcenteronline.com/events/${approval.event_id}`, '_blank');
            }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};


export default function MyApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [answerPreviews, setAnswerPreviews] = useState({});
  const [sentCodes, setSentCodes] = useState(() => {
    // Load sent codes from localStorage on mount
    const saved = localStorage.getItem('sentDoorCodes');
    return saved ? JSON.parse(saved) : {};
  });

  // New states from outline
  const [lastSync, setLastSync] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  // Re-introduced states for ApprovalDetailModal
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);


  // Group color mapping - returns Tailwind classes
  const getGroupColor = (groupName) => {
    const name = groupName?.toLowerCase() || '';

    if (name.includes('building') || name.includes('access')) {
      return {
        border: 'border-blue-300',
        bg: 'bg-blue-50',
        badge: 'bg-blue-100 text-blue-700',
        icon: 'text-blue-600'
      };
    }

    if (name.includes('technology') || name.includes('it') || name.includes('equipment')) {
      return {
        border: 'border-purple-300',
        bg: 'bg-purple-50',
        badge: 'bg-purple-100 text-purple-700',
        icon: 'text-purple-600'
      };
    }

    if (name.includes('av') || name.includes('audio') || name.includes('visual') || name.includes('production')) {
      return {
        border: 'border-green-300',
        bg: 'bg-green-50',
        badge: 'bg-green-100 text-green-700',
        icon: 'text-green-600'
      };
    }

    if (name.includes('kitchen') || name.includes('food') || name.includes('catering')) {
      return {
        border: 'border-orange-300',
        bg: 'bg-orange-50',
        badge: 'bg-orange-100 text-orange-700',
        icon: 'text-orange-600'
      };
    }

    if (name.includes('vehicle') || name.includes('transport')) {
      return {
        border: 'border-cyan-300',
        bg: 'bg-cyan-50',
        badge: 'bg-cyan-100 text-cyan-700',
        icon: 'text-cyan-600'
      };
    }

    // Default color
    return {
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      badge: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600'
    };
  };

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
    if (approvals.length > 0) {
      loadAllAnswerPreviews();
    }
  }, [approvals]);

  // Persist sentCodes to localStorage whenever it changes - keeping this even if feature removed for future proofing
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
      setLastSync(new Date()); // Update last sync time
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadAllAnswerPreviews = async () => {
    // Only load previews for the first few approvals to avoid rate limits
    // Changed to load all for displayed approvals if not already loaded
    for (const approval of approvals) {
      if (!answerPreviews[approval.request_id]) {
        loadAnswerPreview(approval);
      }
    }
  };

  const loadAnswerPreview = async (approval) => {
    try {
      // console.log('📋 Loading answers for:', approval.event_name);

      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      // console.log('📥 Response from getApprovalDetails:', response.data);

      if (response.data?.answers && Object.keys(response.data.answers).length > 0) {
        const answeredQuestions = response.data.questions
          .filter(q => response.data.answers[q.id])
          .map(q => ({
            question: q.question,
            answer: response.data.answers[q.id]
          }));

        // console.log('✅ Found answers:', answeredQuestions);

        setAnswerPreviews(prev => ({
          ...prev,
          [approval.request_id]: answeredQuestions
        }));
      } else {
        // console.log('⚠️ No answers found in response');
      }
    } catch (error) {
      console.error('❌ Error loading answer preview:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Removed handleSendCodeToPCO as per outline changes

  const handleApprovalSuccess = async () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
    await handleSync();
  };

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
        await handleApprovalSuccess(); // Use shared success handler
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
        await handleApprovalSuccess(); // Use shared success handler
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
        setAnswerPreviews({});
        setLastSync(new Date()); // Update last sync time
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  // Re-introduced handleViewDetails for the "View Details" button
  const handleViewDetails = (approval) => {
    setSelectedApproval(approval);
    setShowDetailModal(true);
  };

  const handleModalClose = () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-red-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && <ConnectionWarning />}

        <AppHeader
          icon={ClipboardCheck}
          title="My Approvals"
          description={
            <div className="flex items-center gap-2">
              <span>{approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}</span>
              {lastSync && (
                <span className="text-xs text-slate-500">
                  • Last synced: {format(lastSync, 'h:mm a')}
                </span>
              )}
            </div>
          }
          iconColor="from-orange-500 to-red-500"
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowCalendar(true)} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-orange-600 hover:bg-orange-700 text-white"
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
                    Sync from PCO
                  </>
                )}
              </Button>
            </div>
          }
        />

        <div className="space-y-4">
          <AnimatePresence>
            {approvals.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-600 text-center max-w-md">
                      No pending approvals at the moment. Check back later or sync to refresh.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              approvals.map((approval) => {
                const colors = getGroupColor(approval.approval_group_name);
                const previewAnswers = answerPreviews[approval.request_id] || [];

                return (
                  <motion.div
                    key={approval.request_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`border-2 rounded-lg ${colors.border} ${colors.bg} hover:shadow-lg transition-all`}
                  >
                    <Card className="border-0 bg-transparent">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{approval.event_name}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <div className="flex items-center gap-1">
                                <Calendar className={`w-4 h-4 ${colors.icon}`} />
                                {approval.event_starts_at ? format(parseISO(approval.event_starts_at), 'EEE, MMM d, yyyy') : 'Date not set'}
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <Clock className={`w-4 h-4 ${colors.icon}`} />
                                {approval.event_starts_at ? format(parseISO(approval.event_starts_at), 'h:mm a') : 'Time not set'}
                              </div>
                            </div>
                          </div>
                          <Badge className={`${colors.badge} flex items-center gap-1`}>
                            <AlertCircle className="w-3 h-3" />
                            Pending
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3">
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-4 h-4 ${colors.icon}`} />
                            <span className="font-medium text-slate-700">Resource:</span>
                            <span className="text-slate-900">{approval.resource_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className={`w-4 h-4 ${colors.icon}`} />
                            <span className="font-medium text-slate-700">Approval Group:</span>
                            <Badge className={colors.badge}>
                              {approval.approval_group_name}
                            </Badge>
                          </div>
                        </div>

                        {previewAnswers.length > 0 && (
                          <div className="mt-4 p-3 bg-white/50 rounded-lg border border-slate-200">
                            <p className="text-sm font-semibold text-slate-700 mb-2">Request Details:</p>
                            <div className="space-y-1">
                              {previewAnswers.map((qa, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="text-slate-600">{qa.question}:</span>
                                  <span className="ml-2 text-slate-900 font-medium">{qa.answer}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => handleViewDetails(approval)}
                            variant="outline"
                            className="flex-1"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                          <Button
                            onClick={() => handleApprove(approval)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleDeny(approval)}
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Deny
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
      </div>

      <ApprovalDetailModal
        approval={selectedApproval}
        isOpen={showDetailModal}
        onClose={handleModalClose}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      <ApprovalFormModal />
      <FullApprovalCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        approvals={approvals}
      />
    </div>
  );
}
