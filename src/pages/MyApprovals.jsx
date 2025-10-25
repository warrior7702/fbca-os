import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import FullApprovalCalendarModal from "../components/approvals/FullApprovalCalendarModal";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import { toast } from "sonner";

export default function MyApprovals() {
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

      if (!currentUser?.pco_access_token) {
        setError('Planning Center is not connected. Please connect it in Settings > Integrations.');
        setLoading(false);
        setSyncing(false);
        return;
      }

      // Sync approvals (incremental)
      const syncResponse = await base44.functions.invoke('syncMyApprovals', {
        forceResync: false
      });

      if (syncResponse?.data) {
        setApprovals(syncResponse.data.pending_approvals || []);
        setSyncStats(syncResponse.data.sync_stats || null);
      } else {
        setApprovals([]);
      }

      // Load calendar events
      try {
        const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
        setCalendarEvents(eventsResponse?.data?.events || []);
      } catch (err) {
        console.error('Calendar error:', err);
        setCalendarEvents([]);
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
      const syncResponse = await base44.functions.invoke('syncMyApprovals', {
        forceResync: true
      });

      if (syncResponse?.data) {
        setApprovals(syncResponse.data.pending_approvals || []);
        setSyncStats(syncResponse.data.sync_stats || null);
        toast.success(`Resync complete! Found ${syncResponse.data.count || 0} pending approvals.`);
      }
    } catch (error) {
      console.error('Force resync error:', error);
      setError(error.message || 'Failed to resync');
      toast.error('Failed to resync. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (approval) => {
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
    setSelectedApproval(approval);
    setShowDetailModal(true);
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
                {error.includes('not connected') ? (
                  <Link to={createPageUrl('Settings') + '?tab=integrations'}>
                    <Button size="sm" variant="outline" className="mt-2">
                      Connect Planning Center
                    </Button>
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" onClick={loadData} className="mt-2">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.full_name || 'User';

  return (
    <div className="p-6 md:p-8 h-full overflow-auto bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
            <p className="text-slate-600">Welcome back, {displayName}</p>
            {syncStats && syncStats.last_sync_after && (
              <p className="text-xs text-slate-500 mt-1">
                Last sync: {format(parseISO(syncStats.last_sync_after), 'PPp')} 
                {syncStats.new_upserts > 0 && ` • ${syncStats.new_upserts} new`}
                {syncStats.removed > 0 && ` • ${syncStats.removed} closed`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceResync}
              disabled={syncing}
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
        </div>

        {/* Pending Approvals Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-500" />
                Pending Approvals
              </CardTitle>
              <Badge className="bg-red-500 text-white">
                {approvals.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No pending approvals</p>
                <p className="text-sm text-slate-400 mt-2">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div
                    key={approval.request_id}
                    className="bg-white border-2 border-orange-200 rounded-lg p-4 hover:border-orange-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <h3 className="font-semibold text-lg text-slate-900">
                            {approval.event_name}
                          </h3>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                              {approval.resource_name}
                            </Badge>
                            <span className="text-sm text-slate-600">
                              Qty: {approval.quantity}
                            </span>
                          </div>
                          {approval.event_starts_at && (
                            <p className="text-sm text-slate-600">
                              Event: {format(parseISO(approval.event_starts_at), 'PPP p')}
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            Requested: {format(parseISO(approval.pco_created_at), 'PPp')}
                          </p>
                          <button
                            onClick={() => handleViewDetails(approval)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Click to view details and resource questions →
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleApprove(approval)}
                          disabled={processingApproval === approval.request_id}
                        >
                          {processingApproval === approval.request_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleDeny(approval)}
                          disabled={processingApproval === approval.request_id}
                        >
                          {processingApproval === approval.request_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Deny
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Section */}
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
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full View
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ApprovalCalendar 
              approvals={approvals}
              onApprovalClick={handleViewDetails}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <FullApprovalCalendarModal
        open={showFullCalendar}
        onClose={() => setShowFullCalendar(false)}
        approvals={approvals}
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