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
  ChevronDown,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import CardholderLookup from "../components/approvals/CardholderLookup";
import { Label } from "@/components/ui/label";

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
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedApproval, setExpandedApproval] = useState(null);
  const [approvalDetails, setApprovalDetails] = useState({});
  const [selectedCardholders, setSelectedCardholders] = useState({});
  const [sendingToPCO, setSendingToPCO] = useState({});

  const pendingCount = useMemo(
    () => (groupedApprovals || []).reduce((sum, ev) => sum + (ev.items?.length || 0), 0),
    [groupedApprovals]
  );

  const groupCounts = useMemo(() => {
    const counts = {};
    groupedApprovals.forEach(event => {
      event.items.forEach(item => {
        const groupName = item.approvalGroups?.[0]?.name;
        if (groupName) {
          counts[groupName] = (counts[groupName] || 0) + 1;
        }
      });
    });
    return counts;
  }, [groupedApprovals]);

  const filteredGroupedApprovals = useMemo(() => {
    if (!selectedGroup) return groupedApprovals;
    return groupedApprovals
      .map(event => ({
        ...event,
        items: event.items.filter(item => 
          item.approvalGroups?.some(g => g.name === selectedGroup)
        )
      }))
      .filter(event => event.items.length > 0);
  }, [groupedApprovals, selectedGroup]);

  const displayPendingCount = useMemo(
    () => (filteredGroupedApprovals || []).reduce((sum, ev) => sum + (ev.items?.length || 0), 0),
    [filteredGroupedApprovals]
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

  const fetchApprovalsFromDatabase = useCallback(async () => {
    // Fetch pending approvals from database that belong to this user
    const approvals = await base44.entities.PendingApproval.filter(
      { user_email: user.email, approval_status: 'P' },
      '-event_starts_at',
      100
    );
    
    return approvals.map(approval => ({
      resourceRequestId: approval.request_id,
      eventId: approval.event_id,
      eventName: approval.event_name,
      eventStartsAt: approval.event_starts_at,
      eventEndsAt: approval.event_ends_at,
      resourceId: approval.resource_id,
      resourceName: approval.resource_name,
      approvalGroups: [{ name: approval.approval_group_name }],
      quantity: approval.quantity,
      type: 'resource',
      status: approval.approval_status === 'P' ? 'pending' : approval.approval_status
    }));
  }, [user?.email]);

  const refresh = useCallback(async ({ showToast = false, force = false } = {}) => {
    setSyncing(true);
    try {
      // Sync from PCO first to ensure we have latest data
      const syncResponse = await base44.functions.invoke("syncMyApprovals", { 
        force,
        windowDays: 90 // Get 90 days forward
      });
      
      if (!syncResponse?.data?.success) {
        console.warn("Sync warning:", syncResponse?.data?.error);
      }

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

      if (!groups || groups.length === 0) {
        setGroupedApprovals([]);
        setLastSync(new Date());
        if (showToast) toast.info("You are not assigned to any approval groups.");
        return;
      }

      const approvals = await fetchApprovalsFromDatabase();

      console.log('📦 approvals from database:', approvals);
      console.log('🔍 Total approvals:', approvals.length);
      
      const grouped = groupByEvent(approvals);
      setGroupedApprovals(grouped);
      setLastSync(new Date());

      if (showToast) {
        const totalPending = grouped.reduce((sum, ev) => sum + (ev.items?.length || 0), 0);
        if (totalPending === 0) {
          toast.info(`No pending approvals for: ${groups.join(", ")}`);
        } else {
          toast.success(`Found ${totalPending} pending approval${totalPending !== 1 ? "s" : ""}`);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to load approvals: ${e.message}`);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [fetchApprovalsFromDatabase, getUserGroups]);

  useEffect(() => {
    refresh({ showToast: false });
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !syncing) {
        refresh({ showToast: false });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh, syncing]);

  const loadApprovalDetails = useCallback(async (requestId) => {
    if (approvalDetails[requestId]) return; // Already loaded
    
    try {
      const response = await base44.functions.invoke('getApprovalDetails', { request_id: requestId });
      if (response.data?.ok) {
        setApprovalDetails(prev => ({ ...prev, [requestId]: response.data }));
      }
    } catch (error) {
      console.error('Error loading approval details:', error);
    }
  }, [approvalDetails]);

  const toggleExpanded = useCallback((requestId) => {
    if (expandedApproval === requestId) {
      setExpandedApproval(null);
    } else {
      setExpandedApproval(requestId);
      loadApprovalDetails(requestId);
    }
  }, [expandedApproval, loadApprovalDetails]);

  const handleCardholderSelect = useCallback((requestId, cardholder) => {
    setSelectedCardholders(prev => ({ ...prev, [requestId]: cardholder }));
  }, []);

  const sendToPCO = useCallback(async (requestId, eventGroup, item) => {
    const cardholder = selectedCardholders[requestId];
    if (!cardholder?.pin) {
      toast.error('Please select a cardholder first');
      return;
    }

    setSendingToPCO(prev => ({ ...prev, [requestId]: true }));
    try {
      const badgeCode = `${cardholder.pin}#`;
      const accessTime = eventGroup.eventStartsAt && eventGroup.eventEndsAt
        ? `${format(new Date(eventGroup.eventStartsAt), 'h:mm a')} - ${format(new Date(eventGroup.eventEndsAt), 'h:mm a')}`
        : '';
      
      const response = await base44.functions.invoke('writePCONote', {
        request_id: requestId,
        event_id: eventGroup.eventId,
        badge_code: badgeCode,
        access_time: accessTime
      });

      if (response.data?.ok) {
        toast.success('Door code sent to Planning Center!');
      } else {
        toast.error('Failed to send to Planning Center');
      }
    } catch (error) {
      console.error('Error sending to PCO:', error);
      toast.error('Failed to send to Planning Center');
    } finally {
      setSendingToPCO(prev => ({ ...prev, [requestId]: false }));
    }
  }, [selectedCardholders]);

  const approve = useCallback(async (requestId, eventGroup, item) => {
    setApprovingId(requestId);
    try {
      const cardholder = selectedCardholders[requestId];
      const payload = {
        request_id: requestId,
        action: 'approve',
        event_id: eventGroup.eventId,
        event_name: eventGroup.eventName,
        event_date: eventGroup.eventStartsAt
      };
      
      if (cardholder?.pin) {
        payload.door_code = `${cardholder.pin}#`;
        payload.cardholder_name = cardholder.name;
        payload.cardholder_member_id = cardholder.member_id;
        payload.access_time = eventGroup.eventStartsAt && eventGroup.eventEndsAt
          ? `${format(new Date(eventGroup.eventStartsAt), 'h:mm a')} - ${format(new Date(eventGroup.eventEndsAt), 'h:mm a')}`
          : '';
      }

      const response = await base44.functions.invoke('approveResourceRequest', payload);

      if (response.data?.ok) {
        toast.success('Request approved successfully!');
        
        // Save locally
        if (cardholder?.pin) {
          try {
            await base44.entities.LocalEventCode.create({
              pco_event_id: eventGroup.eventId,
              event_name: eventGroup.eventName,
              event_date: eventGroup.eventStartsAt,
              resource_name: item.resourceName,
              door_code: cardholder.pin,
              cardholder_name: cardholder.name,
              member_id: cardholder.member_id
            });
          } catch (e) {
            console.error('Failed to save local event code:', e);
          }
        }

        refresh({ showToast: false });
      } else {
        toast.error(response.data?.error || 'Failed to approve');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve request');
    } finally {
      setApprovingId(null);
    }
  }, [selectedCardholders, refresh]);

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
                <span>{displayPendingCount} pending approval{displayPendingCount !== 1 ? "s" : ""}{selectedGroup ? ` in ${selectedGroup}` : ''}</span>
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
                    <Badge 
                      key={g} 
                      variant={selectedGroup === g ? "default" : "outline"} 
                      className={`text-xs cursor-pointer transition-all hover:scale-105 ${
                        selectedGroup === g ? 'bg-orange-600 text-white' : ''
                      }`}
                      onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                    >
                      {g} {groupCounts[g] > 0 && `(${groupCounts[g]})`}
                    </Badge>
                  ))}
                  {selectedGroup && (
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-slate-200"
                      onClick={() => setSelectedGroup(null)}
                    >
                      Clear filter
                    </Badge>
                  )}
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
            {displayPendingCount === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-600 text-center max-w-md">
                      {selectedGroup ? `No pending approvals in ${selectedGroup}` : 'No pending approvals at the moment.'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredGroupedApprovals.map(eventGroup => (
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
                      {eventGroup.items.map((item, idx) => {
                        const isExpanded = expandedApproval === item.resourceRequestId;
                        const details = approvalDetails[item.resourceRequestId];
                        const cardholder = selectedCardholders[item.resourceRequestId];
                        const isSending = sendingToPCO[item.resourceRequestId];
                        
                        return (
                          <div
                            key={item.resourceRequestId}
                            className="bg-white/60 rounded-lg border border-slate-200 overflow-hidden"
                          >
                            <div 
                              className="p-3 cursor-pointer hover:bg-slate-50"
                              onClick={() => toggleExpanded(item.resourceRequestId)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <MapPin className="w-4 h-4 text-slate-600" />
                                  <span className="font-medium text-slate-900">{item.resourceName}</span>
                                  {details?.questions?.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {details.questions.length} Questions
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-slate-100 text-slate-700" variant="outline">
                                    Qty: {item.quantity ?? 1}
                                  </Badge>
                                  <ChevronDown 
                                    className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-3 border-t border-slate-200 pt-3 bg-white">
                                {/* Questions and Answers */}
                                {details?.questions?.length > 0 && (
                                  <div className="space-y-2">
                                    {details.questions.map((question) => {
                                      const answer = details.answers?.[question.id];
                                      if (!answer) return null;
                                      
                                      return (
                                        <div key={question.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                                          <p className="text-xs font-semibold text-slate-500 mb-1">
                                            {question.question}
                                          </p>
                                          <p className="text-sm text-slate-900">{answer}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Cardholder Lookup */}
                                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                  <Label className="text-sm font-semibold mb-2 block">Assign Door Code</Label>
                                  <CardholderLookup
                                    onSelect={(ch) => handleCardholderSelect(item.resourceRequestId, ch)}
                                    selected={cardholder}
                                    eventName={eventGroup.eventName}
                                    resourceName={item.resourceName}
                                  />
                                  {cardholder && (
                                    <div className="mt-2 p-2 bg-green-50 border border-green-300 rounded">
                                      <p className="text-sm">
                                        <span className="font-semibold">{cardholder.name}</span>
                                        <span className="text-slate-600"> • Door Code: </span>
                                        <span className="font-mono font-bold text-green-700 text-lg">{cardholder.pin}#</span>
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sendToPCO(item.resourceRequestId, eventGroup, item);
                                    }}
                                    disabled={!cardholder?.pin || isSending}
                                    variant="outline"
                                    className="flex-1 border-blue-300 hover:bg-blue-50"
                                    size="sm"
                                  >
                                    {isSending ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4 mr-2" />
                                    )}
                                    Send to PCO
                                  </Button>
                                  
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      approve(item.resourceRequestId, eventGroup, item);
                                    }}
                                    disabled={approvingId === item.resourceRequestId}
                                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                    size="sm"
                                  >
                                    {approvingId === item.resourceRequestId ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Approve
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

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