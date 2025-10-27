
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/shared/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  ClipboardCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import FullApprovalCalendarModal from "../components/approvals/FullApprovalCalendarModal";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import { toast } from "sonner";
import ConnectionWarning from "../components/shared/ConnectionWarning";

// Safe array coercion
const A = (x) => Array.isArray(x) ? x : [];

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 md:p-8 h-full">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Something went wrong</p>
                  <p className="text-sm">{this.state.error?.message || 'Unknown error'}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="mt-2"
                  >
                    Reload Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function MyApprovalsContent() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(null);
  const [syncStats, setSyncStats] = useState(null);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [debugging, setDebugging] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setSyncing(true);
    setError(null);

    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser?.pco_access_token) {
        const syncResponse = await base44.functions.invoke('syncMyApprovals', {
          forceResync: false
        }).catch(err => {
          console.error('Sync error:', err);
          return { data: { pending_approvals: [], count: 0 } };
        });

        const responseData = syncResponse?.data || {};
        setApprovals(A(responseData.pending_approvals));
        setSyncStats(responseData.sync_stats || null);

        try {
          const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
          setCalendarEvents(A(eventsResponse?.data?.events));
        } catch (err) {
          console.error('Calendar error:', err);
          setCalendarEvents([]);
        }
      } else {
        setApprovals([]);
        setCalendarEvents([]);
        setSyncStats(null);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setError(error.message || 'Failed to load approvals');
      toast.error('Failed to load approvals. Please try again.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleForceResync = async () => {
    setSyncing(true);
    setError(null);
    toast.info('Force resyncing approvals...');

    try {
      if (!user?.pco_access_token) {
        toast.error('Planning Center is not connected. Cannot resync.');
        setSyncing(false);
        return;
      }
      const syncResponse = await base44.functions.invoke('syncMyApprovals', {
        forceResync: true
      });

      const responseData = syncResponse?.data || {};
      setApprovals(A(responseData.pending_approvals));
      setSyncStats(responseData.sync_stats || null);
      toast.success(`Resync complete! Found ${responseData.count || 0} pending approvals.`);
    } catch (error) {
      console.error('Force resync error:', error);
      setError(error.message || 'Failed to resync');
      toast.error('Failed to resync. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDebug = async () => {
    setDebugging(true);
    try {
      const debugResponse = await base44.functions.invoke('debugPCOApprovals');
      console.log('🐛 PCO Debug Results:', debugResponse.data);

      const results = debugResponse.data;
      const message = `
📊 PCO Debug Results:
- Your PCO Person ID: ${results.summary.my_pco_person_id}
- Your Approval Groups: ${results.summary.my_groups_count} (${results.my_groups.map(g => g.name).join(', ')})
- Total Pending Requests in PCO: ${results.summary.total_pending_requests}
- Requests in YOUR Groups: ${results.summary.requests_in_my_groups}
- Requests in Other Groups: ${results.summary.requests_in_other_groups}

Check browser console for full details.
      `;

      alert(message);

      if (results.summary.requests_in_my_groups === 0 && results.summary.total_pending_requests > 0) {
        toast.error('Found pending requests but none are in your approval groups. Check group membership in PCO.');
      } else if (results.summary.requests_in_my_groups > 0) {
        toast.success(`Found ${results.summary.requests_in_my_groups} approvals that should show up!`);
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Debug failed: ' + error.message);
    } finally {
      setDebugging(false);
    }
  };

  const handleApprove = async (approval) => {
    if (!approval?.request_id) return;
    if (!user?.pco_access_token) {
      toast.error('Planning Center is not connected. Cannot approve.');
      return;
    }

    setProcessingApproval(approval.request_id);
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Request approved!');
      await loadData();
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleDeny = async (approval) => {
    if (!approval?.request_id) return;
    if (!user?.pco_access_token) {
      toast.error('Planning Center is not connected. Cannot deny.');
      return;
    }

    setProcessingApproval(approval.request_id);
    try {
      await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Request denied');
      await loadData();
    } catch (error) {
      console.error('Error denying:', error);
      toast.error('Failed to deny request');
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleViewDetails = (approval) => {
    if (!approval) return;
    setSelectedApproval(approval);
    setShowDetailModal(true);
  };

  const handleViewInPCO = (approval) => {
    if (!approval?.event_id) return;
    // Open the event in PCO Calendar
    const pcoUrl = `https://calendar.planningcenteronline.com/events/${approval.event_id}`;
    window.open(pcoUrl, '_blank');
    toast.info('Opening in Planning Center...');
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

  if (error) {
    return (
      <div className="p-6 md:p-8 h-full">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>{error}</p>
                <Button size="sm" variant="outline" onClick={loadData} className="mt-2">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.full_name || 'User';
  const safeApprovals = A(approvals);

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-slate-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && (
          <ConnectionWarning />
        )}

        <AppHeader
          icon={ClipboardCheck}
          title="My Approvals"
          description={`Welcome back, ${displayName}`}
          iconColor="from-orange-500 to-red-500"
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDebug}
                disabled={debugging || !user?.pco_access_token}
              >
                {debugging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Debugging...
                  </>
                ) : (
                  <>
                    🐛 Debug PCO
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceResync}
                disabled={syncing || !user?.pco_access_token}
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Force Resync
                  </>
                )}
              </Button>
              <Link to={createPageUrl("Settings") + "?tab=integrations"}>
                <Button variant="outline" size="sm">
                  Manage Integrations
                </Button>
              </Link>
            </div>
          }
        />

        {syncStats && syncStats.last_sync_after && (
          <p className="text-xs text-slate-500">
            Last sync: {format(parseISO(syncStats.last_sync_after), 'PPp')}
            {syncStats.new_upserts > 0 && ` • ${syncStats.new_upserts} new`}
            {syncStats.removed > 0 && ` • ${syncStats.removed} closed`}
          </p>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-500" />
                Pending Approvals
              </CardTitle>
              <Badge className="bg-red-500 text-white">
                {safeApprovals.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {safeApprovals.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No pending approvals</p>
                <p className="text-sm text-slate-400 mt-2">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {safeApprovals.map((approval) => {
                  if (!approval) return null;

                  return (
                    <Card
                      key={approval.request_id || Math.random()}
                      className="bg-gradient-to-br from-white to-orange-50 border-2 border-orange-200 shadow-md hover:shadow-lg transition-all"
                    >
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-bold text-xl text-slate-900 mb-2">
                                {approval.event_name || 'Unnamed Event'}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-orange-500 text-white">
                                  {approval.approval_group_name || 'Unknown Group'}
                                </Badge>
                                <Badge variant="outline" className="bg-white">
                                  {approval.resource_name || 'Unknown Resource'}
                                </Badge>
                                {approval.quantity > 1 && (
                                  <Badge variant="secondary">
                                    Qty: {approval.quantity}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Event Details */}
                          {approval.event_starts_at && (
                            <div className="bg-white rounded-lg p-4 border border-orange-100">
                              <div className="flex items-center gap-2 text-slate-700">
                                <Calendar className="w-5 h-5 text-orange-500" />
                                <div>
                                  <p className="font-semibold">
                                    {format(parseISO(approval.event_starts_at), 'EEEE, MMMM d, yyyy')}
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    {format(parseISO(approval.event_starts_at), 'h:mm a')}
                                    {approval.event_ends_at && ` - ${format(parseISO(approval.event_ends_at), 'h:mm a')}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Request Info */}
                          {approval.pco_created_at && (
                            <p className="text-sm text-slate-500">
                              Requested {format(parseISO(approval.pco_created_at), 'PPp')}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(approval)}
                              disabled={processingApproval === approval.request_id || !user?.pco_access_token}
                            >
                              {processingApproval === approval.request_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleDeny(approval)}
                              disabled={processingApproval === approval.request_id || !user?.pco_access_token}
                            >
                              {processingApproval === approval.request_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Deny
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(approval)}
                            >
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInPCO(approval)}
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View in PCO
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Calendar - Next 2 Weeks
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullCalendar(true)}
                disabled={!user?.pco_access_token}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full View
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ApprovalCalendar
              approvals={safeApprovals}
              onApprovalClick={handleViewDetails}
            />
          </CardContent>
        </Card>
      </div>

      <FullApprovalCalendarModal
        open={showFullCalendar}
        onClose={() => setShowFullCalendar(false)}
        approvals={safeApprovals}
        onApprovalClick={handleViewDetails}
      />

      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApproval(null);
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}
    </div>
  );
}

export default function MyApprovals() {
  return (
    <ErrorBoundary>
      <MyApprovalsContent />
    </ErrorBoundary>
  );
}
