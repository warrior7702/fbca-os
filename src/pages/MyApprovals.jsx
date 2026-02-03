import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { Input } from "@/components/ui/input";

// Removed external webhook URL - using backend function instead

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full h-[90vh] shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Approval Calendar</h2>
        <div className="flex-grow overflow-hidden">
          <ApprovalCalendar
            approvals={approvals}
            onApprovalClick={() => window.open("https://calendar.planningcenteronline.com/approvals", "_blank")}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

// Normalize groups from API (string[] or {name}[])
function normalizeGroupNames(maybeGroups) {
  if (!Array.isArray(maybeGroups)) return [];
  return maybeGroups
    .map(g => (typeof g === "string" ? g : g?.name))
    .filter(Boolean);
}

// Group approvals by event
function groupByEvent(items) {
  const map = new Map();
  for (const a of items) {
    const key = a.eventId;
    if (!map.has(key)) {
      map.set(key, {
        eventId: a.eventId,
        eventName: a.eventName,
        eventStartsAt: a.eventStartsAt,
        eventEndsAt: a.eventEndsAt,
        items: []
      });
    }
    map.get(key).items.push(a);
  }
  return Array.from(map.values());
}

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [groupedApprovals, setGroupedApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [codeSearches, setCodeSearches] = useState({});
  const [codeResults, setCodeResults] = useState({});
  const [codeSearching, setCodeSearching] = useState({});
  const [selectedCardholders, setSelectedCardholders] = useState({});
  const [sendingCode, setSendingCode] = useState(null);

  const pendingCount = useMemo(
    () => (groupedApprovals || []).reduce((sum, ev) => sum + (ev.items?.length || 0), 0),
    [groupedApprovals]
  );

  const getUserGroups = useCallback(async (email) => {
    const cacheKey = `approval_groups_${email}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const { groups, timestamp } = JSON.parse(cached);
        if (Array.isArray(groups) && (Date.now() - timestamp) < 24 * 60 * 60 * 1000) {
          return groups;
        }
      } catch {}
    }

    const response = await base44.functions.invoke("getUserGroups", {});
    const groups = response?.data?.approvalGroupNames || [];

    localStorage.setItem(cacheKey, JSON.stringify({ groups, timestamp: Date.now() }));
    return groups;
  }, []);

  const fetchApprovalsFromPCO = useCallback(async ({ windowDays = 180 }) => {
    const response = await base44.functions.invoke("syncMyApprovals", { windowDays });
    
    if (!response?.data?.success) {
      throw new Error(response?.data?.error || "Failed to fetch approvals");
    }
    
    // Transform from new format to expected format
    const approvals = (response.data.pending_approvals || []).map(a => ({
      resourceRequestId: a.request_id,
      eventId: a.event_id,
      eventName: a.event_name,
      eventStartsAt: a.event_starts_at,
      eventEndsAt: a.event_ends_at,
      resourceId: a.resource_id,
      resourceName: a.resource_name,
      quantity: a.quantity,
      approvalGroupName: a.approval_group_name,
      answers: a.answers || []
    }));
    
    return {
      approvals,
      totalEvents: response.data.count || 0
    };
  }, []);

  const refresh = useCallback(async ({ showToast = false } = {}) => {
    setSyncing(true);
    try {
      const me = await base44.auth.me();
      setUser(me);

      if (!me?.email) {
        toast.error("User email not found");
        setGroupedApprovals([]);
        setUserGroups([]);
        return;
      }

      const groups = await getUserGroups(me.email);
      console.log("✅ userGroups from getUserGroups:", groups);
      setUserGroups(groups);

      // Still fetch approvals even if getUserGroups returns empty—the sync function determines actual groups
      const api = await fetchApprovalsFromPCO({ windowDays: 180 });
      const approvals = Array.isArray(api.approvals) ? api.approvals : [];

      console.log('📦 approvals from PCO:', approvals);
      console.log('🔍 Total approvals:', approvals.length);
      
      if (approvals.length === 0) {
        setGroupedApprovals([]);
        setLastSync(new Date());
        if (showToast) toast.info("No pending approvals at the moment.");
        setSyncing(false);
        setLoading(false);
        return;
      }

      const grouped = groupByEvent(approvals);
      setGroupedApprovals(grouped);
      setLastSync(new Date());

      if (showToast) {
        const totalPending = grouped.reduce((sum, ev) => sum + (ev.items?.length || 0), 0);
        toast.success(`Found ${totalPending} pending approval${totalPending !== 1 ? "s" : ""}`);
      }
      } catch (e) {
      console.error(e);
      toast.error(`Failed to load approvals: ${e.message}`);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [fetchApprovalsFromPCO, getUserGroups]);

  useEffect(() => {
    refresh({ showToast: false });
  }, [refresh]);

  // Re-fetch approvals when user reconnects PCO
  useEffect(() => {
    if (user?.pco_access_token) {
      refresh({ showToast: false });
    }
  }, [user?.pco_access_token, refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !syncing) {
        refresh({ showToast: false });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh, syncing]);

  const approve = useCallback(async (resourceRequestId, eventId, resourceId) => {
    console.log('🔍 Approve called with resourceRequestId:', resourceRequestId, 'eventId:', eventId, 'resourceId:', resourceId);
    
    if (!user?.pco_access_token) {
      toast.error("Please connect Planning Center in Settings");
      return;
    }

    if (!resourceRequestId || !eventId || !resourceId) {
      toast.error("Missing resource request ID, event ID, or resource ID");
      console.error('❌ Missing IDs:', { resourceRequestId, eventId, resourceId });
      return;
    }

    setApprovingId(resourceRequestId);
    try {
      // Call the backend function with canonical parameter names expected by approveResourceRequest
      const resp = await base44.functions.invoke("approveResourceRequest", { 
        request_id: resourceRequestId, 
        event_id: eventId,
        resource_id: resourceId,
        action: "approve" 
      });
      
      // New implementation returns an `ok` flag instead of `success`
      const ok = resp?.data?.ok ?? resp?.data?.success;
      if (!ok) {
        const errorMsg = resp?.data?.error || "Unknown approval error";
        const errorDetails = resp?.data?.details;
        console.error('❌ Approval failed:', errorMsg, errorDetails);
        throw new Error(errorMsg);
      }

      // Optimistic remove from UI
      setGroupedApprovals(prev =>
        prev
          .map(ev => ({ ...ev, items: ev.items.filter(i => i.resourceRequestId !== resourceRequestId) }))
          .filter(ev => ev.items.length > 0)
      );
      
      // Delete from database
      try {
        const dbApprovals = await base44.entities.PendingApproval.filter({ 
          user_email: user.email,
          request_id: resourceRequestId 
        });
        for (const approval of dbApprovals) {
          await base44.entities.PendingApproval.delete(approval.id);
        }
      } catch (e) {
        console.log('Note: Could not delete approval from DB:', e);
      }
      
      toast.success("Approved successfully in Planning Center!");
    } catch (e) {
      console.error(e);
      toast.error(`Failed to approve: ${e.message}`);
    } finally {
      setApprovingId(null);
    }
  }, [user]);

  const searchCardholders = useCallback(async (requestId, query) => {
    if (query.length < 2) {
      setCodeResults(prev => ({ ...prev, [requestId]: [] }));
      return;
    }

    setCodeSearching(prev => ({ ...prev, [requestId]: true }));
    try {
      const response = await base44.functions.invoke('cardholdersSearch', {
        q: query,
        limit: 5
      });

      if (response.data.ok) {
        setCodeResults(prev => ({ ...prev, [requestId]: response.data.results || [] }));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setCodeSearching(prev => ({ ...prev, [requestId]: false }));
    }
  }, []);

  useEffect(() => {
    Object.entries(codeSearches).forEach(([requestId, query]) => {
      const timer = setTimeout(() => searchCardholders(requestId, query), 300);
      return () => clearTimeout(timer);
    });
  }, [codeSearches, searchCardholders]);

  const sendCodeToPCO = useCallback(async (cardholder, eventId, requestId) => {
    setSendingCode(requestId);
    try {
      const answers = groupedApprovals
        .flatMap(ev => ev.items)
        .find(item => item.resourceRequestId === requestId)?.answers || [];
      
      const accessTimeAnswer = answers.find(a => 
        a.question.toLowerCase().includes('time') && 
        a.question.toLowerCase().includes('access')
      );
      
      await base44.functions.invoke("writePCONote", {
        event_id: eventId,
        badge_code: cardholder.pin,
        access_time: accessTimeAnswer?.answer || ''
      });
      
      toast.success(`Door code ${cardholder.pin}# sent to Planning Center!`);
      setCodeSearches(prev => ({ ...prev, [requestId]: '' }));
      setCodeResults(prev => ({ ...prev, [requestId]: [] }));
      setSelectedCardholders(prev => ({ ...prev, [requestId]: null }));
    } catch (error) {
      console.error('Failed to send door code:', error);
      toast.error('Failed to send door code to Planning Center');
    } finally {
      setSendingCode(null);
    }
  }, [groupedApprovals]);

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
                <span>{pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}</span>
                {lastSync && (
                  <span className="text-xs text-slate-500">
                    • Last synced: {format(lastSync, "h:mm a")}
                  </span>
                )}
              </div>

              {userGroups?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-slate-500">Your groups:</span>
                  {userGroups.map(g => (
                    <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                  ))}
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
                onClick={() => refresh({ showToast: true })}
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
            {pendingCount === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-600 text-center max-w-md">
                      No pending approvals at the moment.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              groupedApprovals.map(eventGroup => (
                <motion.div
                  key={eventGroup.eventId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="border-2 rounded-lg border-slate-300 bg-slate-50 hover:shadow-lg transition-all"
                >
                  <Card className="border-0 bg-transparent">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{eventGroup.eventName}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-slate-600" />
                              {eventGroup.eventStartsAt ? format(parseISO(eventGroup.eventStartsAt), "EEE, MMM d, yyyy") : "Date not set"}
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-slate-600" />
                              {eventGroup.eventStartsAt ? format(parseISO(eventGroup.eventStartsAt), "h:mm a") : "Time not set"}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-slate-100 text-slate-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {eventGroup.items.length} Pending
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {eventGroup.items.map(item => (
                        <div
                          key={item.resourceRequestId}
                          className="p-3 bg-white/60 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-600" />
                              <span className="font-medium text-slate-900">{item.resourceName}</span>
                              {item.type === "room" && <span className="text-xs">🏢</span>}
                              {item.type === "resource" && <span className="text-xs">📦</span>}
                            </div>
                            <Badge className="bg-slate-100 text-slate-700" variant="outline">
                              Qty: {item.quantity ?? 1}
                            </Badge>
                          </div>

                          {/* Request Answers */}
                          {item.answers && item.answers.length > 0 && (
                            <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs font-semibold text-blue-900 mb-2">Request Details</p>
                              <div className="space-y-2">
                                {item.answers.map((answer, idx) => {
                                  const answerDisplay = Array.isArray(answer.answer) 
                                    ? answer.answer.join(", ")
                                    : answer.answer;
                                  return (
                                    <div key={idx} className="flex flex-col">
                                      <span className="text-slate-600 text-xs font-medium">{answer.question}</span>
                                      <span className="text-slate-900 text-sm">{answerDisplay}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {item.resourceName === "Building Access" && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-slate-700">Send Door Code to PCO</span>
                              </div>
                              <Input
                                placeholder="Search by name or 6-digit code..."
                                value={codeSearches[item.resourceRequestId] || ''}
                                onChange={(e) => setCodeSearches(prev => ({ ...prev, [item.resourceRequestId]: e.target.value }))}
                                className="text-sm"
                              />
                              {codeSearching[item.resourceRequestId] && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Searching...
                                </div>
                              )}
                              {codeResults[item.resourceRequestId]?.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {codeResults[item.resourceRequestId].map(cardholder => (
                                    <button
                                      key={cardholder.id}
                                      onClick={() => setSelectedCardholders(prev => ({ ...prev, [item.resourceRequestId]: cardholder }))}
                                      className={`w-full flex items-center gap-2 p-2 hover:bg-blue-50 rounded border transition-colors text-left ${
                                        selectedCardholders[item.resourceRequestId]?.id === cardholder.id
                                          ? 'border-blue-500 bg-blue-50'
                                          : 'border-slate-200 hover:border-blue-300'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-xs font-bold">{cardholder.name[0]}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 text-sm">{cardholder.name}</p>
                                        <p className="text-xs text-slate-600 font-mono">{cardholder.pin}#</p>
                                      </div>
                                      {selectedCardholders[item.resourceRequestId]?.id === cardholder.id && (
                                        <CheckCircle className="w-4 h-4 text-blue-600" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedCardholders[item.resourceRequestId] && (
                                <Button
                                  onClick={() => sendCodeToPCO(selectedCardholders[item.resourceRequestId], eventGroup.eventId, item.resourceRequestId)}
                                  disabled={sendingCode === item.resourceRequestId}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  size="sm"
                                >
                                  {sendingCode === item.resourceRequestId ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Key className="w-4 h-4 mr-2" />
                                      Send {selectedCardholders[item.resourceRequestId].pin}# to PCO
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}

                          <Button
                            onClick={() => window.open("https://calendar.planningcenteronline.com/approvals", "_blank")}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            Go to PCO
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Debug Panel - Remove after troubleshooting */}
        {debugInfo && (
          <Card className="border-2 border-yellow-400 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800">Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><strong>Your Groups:</strong> {debugInfo.userGroups?.join(", ") || "None"}</div>
              <div><strong>Your Group IDs:</strong> {debugInfo.userGroupIds?.join(", ") || "None"}</div>
              <div><strong>All Groups in PCO:</strong></div>
              <ul className="ml-4 text-xs">
                {debugInfo.allGroupsFromPCO?.map(g => (
                  <li key={g.id}>{g.name} (ID: {g.id})</li>
                ))}
              </ul>
              <div><strong>Resources Mapped to Groups:</strong> {debugInfo.resourceToGroupCount}</div>
              <div><strong>Total Pending Requests in PCO:</strong> {debugInfo.totalPendingInPCO}</div>
              {debugInfo.samplePendingRequests?.length > 0 && (
                <>
                  <div><strong>Sample Pending Requests:</strong></div>
                  <ul className="ml-4 text-xs">
                    {debugInfo.samplePendingRequests.map(r => (
                      <li key={r.id}>
                        Request {r.id}: Resource {r.resourceId} →
                        {r.mappedGroup ? ` Group "${r.mappedGroup.groupName}" (${r.mappedGroup.groupId})` : " NO GROUP MAPPING"}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <FullApprovalCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        approvals={groupedApprovals.flatMap(ev =>
          ev.items.map(item => ({
            ...item,
            event_name: ev.eventName,
            event_starts_at: ev.eventStartsAt,
            event_ends_at: ev.eventEndsAt,
            request_id: item.resourceRequestId,
            resource_name: item.resourceName
          }))
        )}
        />

      </div>
        );
        }