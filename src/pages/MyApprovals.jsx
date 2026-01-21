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
  Key,
  User,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";

const AppHeader = ({ icon: Icon, title, description, iconColor, action }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${iconColor}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <div className="text-slate-600">{description}</div>
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
              window.open('https://calendar.planningcenteronline.com/approvals', '_blank');
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
  const [postedDoorCodes, setPostedDoorCodes] = useState({});
  const [cardholderSearchQuery, setCardholderSearchQuery] = useState({});
  const [cardholderSearchResults, setCardholderSearchResults] = useState({});
  const [searchingCardholder, setSearchingCardholder] = useState({});
  const [smartSuggestions, setSmartSuggestions] = useState({});

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
      loadPostedDoorCodes();
    }
  }, [approvals]);

  // NEW: Use API for smart suggestions when answers are loaded
  useEffect(() => {
    if (Object.keys(answerPreviews).length > 0) {
      autoSuggestCodes();
    }
  }, [answerPreviews]);

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
      // Auto-sync on page load to get fresh data from Vercel
      const response = await fetch(
        'https://pco-webhook.vercel.app/api/cron/pco-sync?approvals=1&windowDays=30&maxEvents=100'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setApprovals(data.approvals || []);
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

      if (response.data?.detailed_answers && response.data.detailed_answers.length > 0) {
        // New format with detailed answers from /event_resource_requests/{id}/answers
        setAnswerPreviews(prev => ({
          ...prev,
          [approval.request_id]: response.data.detailed_answers
        }));
      } else if (response.data?.answers && Object.keys(response.data.answers).length > 0) {
        // Fallback to old format
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

  const loadPostedDoorCodes = async () => {
    for (const approval of approvals) {
      try {
        const response = await base44.functions.invoke('getPCOEventComments', {
          event_id: approval.event_id
        });

        if (response.data.comments) {
          const doorCodeComment = response.data.comments.find(c =>
            c.body?.includes('🚪 Building Access Approved') && c.body?.includes('Door Code:')
          );

          if (doorCodeComment) {
            const match = doorCodeComment.body.match(/Door Code:\s*(\d+)/);
            if (match) {
              setPostedDoorCodes(prev => ({
                ...prev,
                [approval.request_id]: match[1]
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading door code for approval:', error);
      }
    }
  };

  // NEW: Use learning API for smart suggestions
  const autoSuggestCodes = async () => {
    console.log('🧠 Getting smart suggestions from learning API...');
    
    for (const approval of approvals) {
      if (postedDoorCodes[approval.request_id] || doorCodes[approval.request_id]) {
        continue;
      }
      
      try {
        const answers = answerPreviews[approval.request_id];
        const response = await base44.functions.invoke('getSmartSuggestion', {
          event_name: approval.event_name,
          resource_name: approval.resource_name,
          answers: answers
        });
        
        if (response.data.ok && response.data.suggestion) {
          const suggestion = response.data.suggestion;
          const isLearned = response.data.learned;
          
          setSmartSuggestions(prev => ({
            ...prev,
            [approval.request_id]: {
              ...suggestion,
              learned: isLearned,
              confidence: response.data.confidence // Assuming confidence comes from API
            }
          }));
          
          // If we have a learned cardholder, pre-fill it
          if (isLearned && suggestion.cardholder) {
            console.log('✨ Pre-filling learned code:', suggestion.cardholder.pin);
            setDoorCodes(prev => ({ ...prev, [approval.request_id]: suggestion.cardholder.pin }));
            setCardholderSearchQuery(prev => ({ ...prev, [approval.request_id]: suggestion.cardholder.pin }));
            toast.success(`🎓 Smart learned: ${suggestion.cardholder.name} (${suggestion.reason})`, { duration: 3000 });
          }
          // If we found an explicit code
          else if (suggestion.code) {
            console.log('✨ Pre-filling code:', suggestion.code);
            setDoorCodes(prev => ({ ...prev, [approval.request_id]: suggestion.code }));
            setCardholderSearchQuery(prev => ({ ...prev, [approval.request_id]: suggestion.code }));
            toast.success(`Smart-filled code: ${suggestion.code}`, { duration: 2000 });
          }
          // If we have a search term
          else if (suggestion.search) {
            console.log('🔍 Auto-searching for:', suggestion.search);
            searchCardholders(approval.request_id, suggestion.search);
          }
        }
      } catch (error) {
        console.error('Error getting smart suggestion:', error);
      }
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        'https://pco-webhook.vercel.app/api/cron/pco-sync?approvals=1&windowDays=30&maxEvents=100'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const approvalsList = data.approvals || [];
      
      toast.success(`Synced ${approvalsList.length} pending approval${approvalsList.length !== 1 ? 's' : ''}`);
      setApprovals(approvalsList);
      setAnswerPreviews({});
      setPostedDoorCodes({});
      setSmartSuggestions({});
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  const searchCardholders = async (requestId, query) => {
    if (!query || query.length < 2) {
      setCardholderSearchResults(prev => ({ ...prev, [requestId]: [] }));
      return;
    }

    setSearchingCardholder(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await base44.functions.invoke('cardholdersSearch', {
        q: query,
        limit: 5
      });

      if (response.data.ok) {
        setCardholderSearchResults(prev => ({
          ...prev,
          [requestId]: response.data.results || []
        }));
      } else {
        toast.error(response.data.error || 'Failed to search cardholders');
        setCardholderSearchResults(prev => ({ ...prev, [requestId]: [] }));
      }
    } catch (error) {
      console.error('Cardholder search error:', error);
      toast.error('Error during cardholder search');
      setCardholderSearchResults(prev => ({ ...prev, [requestId]: [] }));
    } finally {
      setSearchingCardholder(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleCardholderSearchChange = (requestId, value) => {
    setCardholderSearchQuery(prev => ({ ...prev, [requestId]: value }));

    if (window.cardholderSearchTimeout) {
      clearTimeout(window.cardholderSearchTimeout);
    }

    window.cardholderSearchTimeout = setTimeout(() => {
      searchCardholders(requestId, value);
    }, 300);
  };

  const handleSelectCardholder = async (requestId, cardholder, approval) => {
    setDoorCodes(prev => ({ ...prev, [requestId]: cardholder.pin }));
    setCardholderSearchQuery(prev => ({ ...prev, [requestId]: cardholder.pin }));
    setCardholderSearchResults(prev => ({ ...prev, [requestId]: [] }));
    
    // Learn from this selection
    try {
      const searchTerm = cardholderSearchQuery[requestId];
      await base44.functions.invoke('learnFromSelection', {
        event_name: approval.event_name,
        resource_name: approval.resource_name,
        selected_cardholder: cardholder,
        search_term: searchTerm
      });
      console.log('📚 Learned from selection:', cardholder.name);
    } catch (error) {
      console.error('Error learning from selection:', error);
    }
  };

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
        
        setPostedDoorCodes(prev => ({
          ...prev,
          [approval.request_id]: doorCode.trim()
        }));
        
        setDoorCodes(prev => ({ ...prev, [approval.request_id]: '' }));
        setCardholderSearchQuery(prev => ({ ...prev, [approval.request_id]: '' }));
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span>{approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}</span>
                {lastSync && (
                  <span className="text-xs text-slate-500">
                    • Last synced: {format(lastSync, 'h:mm a')}
                  </span>
                )}
              </div>
              {approvals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(
                    approvals.reduce((acc, a) => {
                      const group = a.approval_group_name || 'Unknown';
                      acc[group] = (acc[group] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([groupName, count]) => {
                    const colors = getGroupColor(groupName);
                    return (
                      <Badge key={groupName} className={`${colors.badge} text-xs`}>
                        {groupName}: {count}
                      </Badge>
                    );
                  })}
                </div>
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
              // Group approvals by event for non-building access, keep building access separate
              (() => {
                const buildingAccessApprovals = approvals.filter(a => 
                  a.approval_group_name?.toLowerCase().includes('building') || 
                  a.approval_group_name?.toLowerCase().includes('access')
                );
                const otherApprovals = approvals.filter(a => 
                  !(a.approval_group_name?.toLowerCase().includes('building') || 
                    a.approval_group_name?.toLowerCase().includes('access'))
                );
                
                // Group other approvals by event
                const groupedByEvent = otherApprovals.reduce((acc, approval) => {
                  const eventKey = approval.event_id;
                  if (!acc[eventKey]) {
                    acc[eventKey] = {
                      event_id: approval.event_id,
                      event_name: approval.event_name,
                      event_starts_at: approval.event_starts_at,
                      approvals: []
                    };
                  }
                  acc[eventKey].approvals.push(approval);
                  return acc;
                }, {});

                return (
                  <>
                    {/* Building Access Approvals - Individual Cards */}
                    {buildingAccessApprovals.map((approval) => {
                const colors = getGroupColor(approval.approval_group_name);
                const previewAnswers = answerPreviews[approval.request_id] || [];
                const postedCode = postedDoorCodes[approval.request_id];
                const smartSuggestion = smartSuggestions[approval.request_id];

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

                        {/* Building Access specific UI */}
                        {(approval.approval_group_name?.toLowerCase().includes('building') || 
                          approval.approval_group_name?.toLowerCase().includes('access')) && (
                          <>
                            {/* Smart Suggestion Badge - NOW SHOWS IF LEARNED */}
                            {smartSuggestion && !postedCode && (
                              <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                                smartSuggestion.learned 
                                  ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300' 
                                  : 'bg-purple-50 border-purple-200'
                              }`}>
                                <Sparkles className={`w-4 h-4 ${smartSuggestion.learned ? 'text-pink-600' : 'text-purple-600'}`} />
                                <span className={`text-xs font-medium ${smartSuggestion.learned ? 'text-pink-700' : 'text-purple-700'}`}>
                                  {smartSuggestion.learned ? '🎓 Learned: ' : 'Smart: '}{smartSuggestion.reason}
                                </span>
                                {smartSuggestion.learned && smartSuggestion.confidence && (
                                  <Badge variant="outline" className="text-xs bg-white/50">
                                    {Math.round(smartSuggestion.confidence * 100)}% confident
                                  </Badge>
                                )}
                              </div>
                            )}

                            {postedCode && (
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                <Key className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800 font-medium">
                                  Door Code Posted: <span className="font-mono font-bold">{postedCode}</span>
                                </span>
                              </div>
                            )}

                            <div className="space-y-2 pt-4">
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder="Type name, code, or building (PCB/FBC/WADE/SB)..."
                                  value={cardholderSearchQuery[approval.request_id] || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setDoorCodes(prev => ({ ...prev, [approval.request_id]: value }));
                                    handleCardholderSearchChange(approval.request_id, value);
                                  }}
                                  className="w-full"
                                  maxLength={50}
                                  disabled={!!postedCode}
                                />
                                {searchingCardholder[approval.request_id] && (
                                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                                )}
                                
                                {cardholderSearchResults[approval.request_id]?.length > 0 && !postedCode && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                    {cardholderSearchResults[approval.request_id].map((cardholder) => (
                                      <button
                                        key={cardholder.id}
                                        onClick={() => handleSelectCardholder(approval.request_id, cardholder, approval)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-0"
                                      >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                          <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-slate-900">{cardholder.name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-sm text-blue-600 flex items-center gap-1 font-mono font-semibold">
                                              <Key className="w-3 h-3" />
                                              {cardholder.pin}#
                                            </span>
                                            {cardholder.member_id && (
                                              <span className="text-xs text-slate-500">
                                                • ID: {cardholder.member_id}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleSendCode(approval)}
                                  disabled={sendingCode === approval.request_id || !doorCodes[approval.request_id] || doorCodes[approval.request_id].trim() === '' || !!postedCode}
                                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                >
                                  {sendingCode === approval.request_id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Key className="w-4 h-4 mr-2" />
                                  )}
                                  {postedCode ? 'Code Already Posted' : 'Send to PCO'}
                                </Button>
                                <Button
                                  onClick={() => window.open('https://calendar.planningcenteronline.com/approvals', '_blank')}
                                  variant="outline"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View in PCO
                                </Button>
                              </div>
                            </div>
                          </>
                        )}

                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

                    {/* Grouped Event Approvals (Room Setup, Maintenance, etc.) */}
                    {Object.values(groupedByEvent).map((eventGroup) => {
                      const firstApproval = eventGroup.approvals[0];
                      const colors = getGroupColor(firstApproval.approval_group_name);

                      return (
                        <motion.div
                          key={eventGroup.event_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className={`border-2 rounded-lg ${colors.border} ${colors.bg} hover:shadow-lg transition-all`}
                        >
                          <Card className="border-0 bg-transparent">
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-xl mb-2">{eventGroup.event_name}</CardTitle>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                    <div className="flex items-center gap-1">
                                      <Calendar className={`w-4 h-4 ${colors.icon}`} />
                                      {eventGroup.event_starts_at ? format(parseISO(eventGroup.event_starts_at), 'EEE, MMM d, yyyy') : 'Date not set'}
                                    </div>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                      <Clock className={`w-4 h-4 ${colors.icon}`} />
                                      {eventGroup.event_starts_at ? format(parseISO(eventGroup.event_starts_at), 'h:mm a') : 'Time not set'}
                                    </div>
                                  </div>
                                </div>
                                <Badge className={`${colors.badge} flex items-center gap-1`}>
                                  <AlertCircle className="w-3 h-3" />
                                  {eventGroup.approvals.length} Pending
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {/* List each room/resource in this event */}
                              {eventGroup.approvals.map((approval) => {
                                const approvalColors = getGroupColor(approval.approval_group_name);
                                const previewAnswers = answerPreviews[approval.request_id] || [];

                                return (
                                  <div 
                                    key={approval.request_id}
                                    className="p-3 bg-white/60 rounded-lg border border-slate-200"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <MapPin className={`w-4 h-4 ${approvalColors.icon}`} />
                                        <span className="font-medium text-slate-900">{approval.resource_name}</span>
                                      </div>
                                      <Badge className={approvalColors.badge} variant="outline">
                                        {approval.approval_group_name}
                                      </Badge>
                                    </div>

                                    {previewAnswers.length > 0 && (
                                      <div className="mt-2 pl-6 space-y-1">
                                        {previewAnswers.map((qa, idx) => (
                                          <div key={idx} className="text-sm">
                                            <span className="text-slate-600">{qa.question}:</span>
                                            <span className="ml-2 text-slate-900 font-medium">{qa.answer}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              <div className="pt-2">
                                <Button
                                  onClick={() => window.open('https://calendar.planningcenteronline.com/approvals', '_blank')}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View All in PCO
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </>
                );
              })()
            )}
          </AnimatePresence>
        </div>
      </div>

      <FullApprovalCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        approvals={approvals}
      />
    </div>
  );
}