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
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";

const PCO_SYNC_URL = "https://pco-webhook.vercel.app/api/cron/pco-sync";

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

  const fetchApprovalsFromPCO = useCallback(async ({ email, windowDays = 180, maxEvents = 500 }) => {
    const url = `${PCO_SYNC_URL}?approvals=1&windowDays=${windowDays}&maxEvents=${maxEvents}&email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `PCO sync error (${res.status})`);
    }
    return data;
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
      setUserGroups(groups);

      if (!groups || groups.length === 0) {
        setGroupedApprovals([]);
        setLastSync(new Date());
        if (showToast) toast.info("You are not assigned to any approval groups.");
        return;
      }

      const api = await fetchApprovalsFromPCO({ email: me.email, windowDays: 180, maxEvents: 500 });

      console.log('🔍 API Response:', {
        totalApprovals: api.approvals?.length || 0,
        totalEvents: api.totalEvents,
        sampleApproval: api.approvals?.[0]
      });

      const approvals = Array.isArray(api.approvals) ? api.approvals : [];
      
      // prefer `approvalGroupNames: string[]` if provided by API
      const filtered = approvals.filter(a => {
        const names =
          Array.isArray(a.approvalGroupNames) ? a.approvalGroupNames :
          normalizeGroupNames(a.approvalGroups);

        const hasMatch = names.some(n => groups.includes(n));
        
        if (!hasMatch && a.eventName) {
          console.log('❌ No match:', {
            event: a.eventName,
            resource: a.resourceName,
            approvalGroupsOnItem: names,
            userGroups: groups
          });
        }

        return hasMatch;
      });

      console.log('✅ Filtered approvals:', filtered.length, 'out of', approvals.length);

      const grouped = groupByEvent(filtered);
      setGroupedApprovals(grouped);
      setLastSync(new Date());

      if (showToast) {
        if (filtered.length === 0) {
          toast.info(`No pending approvals for: ${groups.join(", ")}`);
        } else {
          toast.success(`Found ${filtered.length} pending approval${filtered.length !== 1 ? "s" : ""}`);
        }
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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !syncing) {
        refresh({ showToast: false });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh, syncing]);

  const approve = useCallback(async (resourceRequestId) => {
    setApprovingId(resourceRequestId);
    try {
      const resp = await base44.functions.invoke("approvePCOResourceRequest", { resourceRequestId });
      if (!resp?.data?.success) throw new Error(resp?.data?.error || "Unknown approval error");

      // Optimistic remove
      setGroupedApprovals(prev =>
        prev
          .map(ev => ({ ...ev, items: ev.items.filter(i => i.resourceRequestId !== resourceRequestId) }))
          .filter(ev => ev.items.length > 0)
      );
      toast.success("Approved successfully!");
    } catch (e) {
      console.error(e);
      toast.error(`Failed to approve: ${e.message}`);
    } finally {
      setApprovingId(null);
    }
  }, []);

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

                          <div className="flex gap-2 mt-3">
                            <Button
                              onClick={() => approve(item.resourceRequestId)}
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
                            <Button
                              onClick={() => window.open("https://calendar.planningcenteronline.com/approvals", "_blank")}
                              variant="outline"
                              size="sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
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