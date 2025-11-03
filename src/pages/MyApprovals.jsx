
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Users,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";
// CardholderLookup is no longer needed

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
  const [lastSync, setLastSync] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [doorCodes, setDoorCodes] = useState({});
  const [sendingCode, setSendingCode] = useState(null);
  // showCardholderLookup and currentApprovalForLookup states are removed

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
      setLastSync(new Date());
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadAllAnswerPreviews = async () => {
    for (const approval of approvals) {
      if (!answerPreviews[approval.request_id]) {
        loadAnswerPreview(approval);
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

      if (response.data?.answers && Object.keys(response.data.answers).length > 0) {
        const answeredQuestions = response.data.questions
          .filter(q => response.data.answers[q.id])
          .map(q => ({
            question: q.question,
            answer: response.data.answers[q.id]
          }));

        setAnswerPreviews(prev => ({
          ...prev,
          [approval.request_id]: answeredQuestions
        }));
      }
    } catch (error) {
      console.error('❌ Error loading answer preview:', error);
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
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  // handleOpenCardholderLookup and handleSelectCardholder are removed

  const handleSendCode = async (approval) => {
    const doorCode = doorCodes[approval.request_id];
    
    if (!doorCode || doorCode.trim() === '') {
      toast.error('Please enter a door code');
      return;
    }

    setSendingCode(approval.request_id);
    
    try {
      console.log('🚪 Posting door code to PCO event...');
      
      const response = await base44.functions.invoke('writePCONote', {
        event_id: approval.event_id,
        badge_code: doorCode.trim()
      });

      if (response.data.ok) {
        toast.success('Door code posted to event activity in PCO!');
        setDoorCodes(prev => ({ ...prev, [approval.request_id]: '' }));
      } else {
        toast.error(response.data.error || 'Failed to post door code');
      }
    } catch (error) {
      console.error('Error posting door code:', error);
      toast.error('Failed to post door code to PCO');
    } finally {
      setSendingCode(null);
    }
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
                          <div className="flex-1 flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter door code (e.g. 123456)"
                              value={doorCodes[approval.request_id] || ''}
                              onChange={(e) => setDoorCodes(prev => ({ ...prev, [approval.request_id]: e.target.value }))}
                              className="flex-1"
                              maxLength={10}
                            />
                            {/* Removed the Search button */}
                            <Button
                              onClick={() => handleSendCode(approval)}
                              disabled={sendingCode === approval.request_id}
                              className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                            >
                              {sendingCode === approval.request_id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Key className="w-4 h-4 mr-2" />
                              )}
                              Send to PCO
                            </Button>
                          </div>
                          <Button
                            onClick={() => window.open(`https://calendar.planningcenteronline.com/calendar/${approval.event_id}/approvals`, '_blank')}
                            variant="outline"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View in PCO
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

      <FullApprovalCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        approvals={approvals}
      />
      {/* CardholderLookup component is removed */}
    </div>
  );
}
