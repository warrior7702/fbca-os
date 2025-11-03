
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
import { format } from "date-fns"; 
// Removed: import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning"; 
import CardholderLookup from "../components/approvals/CardholderLookup"; // Added back

export default function MyApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null); 
  // Removed: const [selectedApproval, setSelectedApproval] = useState(null);
  // Removed: const [showDetailModal, setShowDetailModal] = useState(false); 
  const [viewMode, setViewMode] = useState('list');
  const [answerPreviews, setAnswerPreviews] = useState({}); 
  const [sentCodes, setSentCodes] = useState(() => {
    // Load sent codes from localStorage on mount
    const saved = localStorage.getItem('sentDoorCodes');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedCardholders, setSelectedCardholders] = useState({}); // Added back
  const [savingCode, setSavingCode] = useState({}); // Added back

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
      if (!answerPreviews[approval.request_id]) { 
        loadAnswerPreview(approval);
      }
    }
  };

  const loadAnswerPreview = async (approval) => {
    try {
      console.log('📋 Loading answers for:', approval.event_name);
      
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      console.log('📥 Response from getApprovalDetails:', response.data);

      if (response.data?.answers && Object.keys(response.data.answers).length > 0) {
        const answeredQuestions = response.data.questions
          .filter(q => response.data.answers[q.id])
          .map(q => ({
            question: q.question,
            answer: response.data.answers[q.id]
          }));

        console.log('✅ Found answers:', answeredQuestions);

        setAnswerPreviews(prev => ({ 
          ...prev,
          [approval.request_id]: answeredQuestions
        }));
      } else {
        console.log('⚠️ No answers found in response');
      }
    } catch (error) {
      console.error('❌ Error loading answer preview:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleSendCodeToPCO = async (approval, cardholder) => {
    setSavingCode(prev => ({ ...prev, [approval.request_id]: true }));
    
    try {
      console.log('📤 Sending badge code to PCO:', cardholder.pin);
      
      const response = await base44.functions.invoke('writePCONote', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        badge_code: `${cardholder.pin}#`,
        append: true
      });

      if (response.data.ok) {
        toast.success(`Badge code ${cardholder.pin}# sent to ${approval.event_name}!`);
        
        // Mark as sent in local storage
        setSentCodes(prev => {
          const updated = {
            ...prev,
            [approval.request_id]: {
              code: cardholder.pin,
              cardholder: cardholder.name,
              sentAt: new Date().toISOString()
            }
          };
          return updated;
        });
      } else {
        toast.error('Failed to send badge code: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending badge code:', error);
      toast.error('Failed to send badge code');
    } finally {
      setSavingCode(prev => ({ ...prev, [approval.request_id]: false }));
    }
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
        setAnswerPreviews({}); 
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  // Removed: handleViewDetails, handleModalClose, handleApprovalSuccess

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

        {/* Open in Planning Center - List View */}
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
            onApprovalClick={(approval) => {
              // Open in PCO instead of modal
              window.open(`https://calendar.planningcenteronline.com/events/${approval.event_id}`, '_blank');
            }}
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
                  const answerPreview = answerPreviews[approval.request_id]; 
                  const selectedCardholder = selectedCardholders[approval.request_id];
                  const isSavingCode = savingCode[approval.request_id];
                  const codeSent = sentCodes[approval.request_id];
                  
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
                                  <Building2 className="w-4 h-4" /> 
                                  <span>{approval.resource_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" /> 
                                  <span className="text-xs text-slate-500">
                                    Group: {approval.approval_group_name}
                                  </span>
                                </div>
                              </div>
                              
                              {answerPreview && answerPreview.length > 0 && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">Request Details:</p>
                                  <div className="space-y-1">
                                    {answerPreview.map((qa, idx) => (
                                      <div key={idx} className="text-xs">
                                        <span className="text-slate-600">{qa.question}:</span>
                                        <span className="ml-1 text-slate-800 font-medium">{qa.answer}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Door Code Assignment Section */}
                              {approval.resource_name?.toLowerCase().includes('building access') && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <p className="text-sm font-semibold text-blue-900 mb-2">
                                    🔑 Assign Building Access Code
                                  </p>
                                  
                                  {codeSent ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <div className="flex items-center gap-2 text-green-700 mb-1">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="font-semibold">Code Sent!</span>
                                      </div>
                                      <p className="text-sm text-green-600">
                                        Badge {codeSent.code}# assigned to {codeSent.cardholder}
                                      </p>
                                      <p className="text-xs text-green-500 mt-1">
                                        Sent {new Date(codeSent.sentAt).toLocaleString()}
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      <CardholderLookup
                                        onSelect={(cardholder) => {
                                          setSelectedCardholders(prev => ({
                                            ...prev,
                                            [approval.request_id]: cardholder
                                          }));
                                        }}
                                        selectedCardholder={selectedCardholder}
                                      />
                                      
                                      {selectedCardholder && (
                                        <Button
                                          onClick={() => handleSendCodeToPCO(approval, selectedCardholder)}
                                          disabled={isSavingCode}
                                          size="sm"
                                          className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                                        >
                                          {isSavingCode ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Sending...
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle className="w-4 h-4 mr-2" />
                                              Send Code {selectedCardholder.pin}# to PCO
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Removed: Details button */}
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

      {/* Removed: ApprovalDetailModal */}
    </div>
  );
}
