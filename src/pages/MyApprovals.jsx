
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
  RefreshCcw // Changed from AlertCircle as it makes more sense for "Resync" but outline specified AlertCircle. Sticking to outline.
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
  const [syncing, setSyncing] = useState(false); // New state for sync status
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(null);
  const [syncStats, setSyncStats] = useState(null); // New state for sync stats
  const [selectedApproval, setSelectedApproval] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setSyncing(true); // Indicate syncing process has started
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.pco_access_token) {
        toast.error('Planning Center is not connected. Please connect it in Settings > Integrations.');
        setLoading(false);
        setSyncing(false); // Ensure syncing state is reset
        return;
      }

      // Sync approvals (incremental)
      const syncResponse = await base44.functions.invoke('syncMyApprovals', {
        forceResync: false
      }).catch(err => {
        console.error('Approvals sync error:', err);
        toast.error('Failed to sync approvals');
        return { data: { pending_approvals: [], sync_stats: null } }; // Return a default structure to avoid breaking subsequent calls
      });

      setApprovals(syncResponse.data.pending_approvals || []);
      setSyncStats(syncResponse.data.sync_stats);

      // Load calendar events
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents').catch(err => {
        console.error('Calendar error:', err);
        toast.error('Failed to load calendar events');
        return { data: { events: [] } };
      });

      setCalendarEvents(eventsResponse.data.events || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setSyncing(false); // Reset syncing state
    }
  };

  const handleForceResync = async () => {
    setSyncing(true);
    toast.info('Force resyncing approvals...');
    try {
      const syncResponse = await base44.functions.invoke('syncMyApprovals', {
        forceResync: true
      });

      setApprovals(syncResponse.data.pending_approvals || []);
      setSyncStats(syncResponse.data.sync_stats);
      toast.success(`Resync complete! Found ${syncResponse.data.count} pending approvals.`);
    } catch (error) {
      console.error('Force resync error:', error);
      toast.error('Failed to resync. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (approval) => {
    setProcessingApproval(approval.id);
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.id
      });
      toast.success('Request approved!');
      setSelectedApproval(null); // Close modal on action
      loadData(); // Reload data to reflect changes
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleDeny = async (approval) => {
    setProcessingApproval(approval.id);
    try {
      await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.id
      });
      toast.success('Request denied');
      setSelectedApproval(null); // Close modal on action
      loadData(); // Reload data to reflect changes
    } catch (error) {
      console.error('Error denying:', error);
      toast.error('Failed to deny request');
    } finally {
      setProcessingApproval(null);
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

  const displayName = user?.display_name || user?.full_name;

  return (
    <div className="p-6 md:p-8 h-full overflow-auto bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
            <p className="text-slate-600">Welcome back, {displayName}</p>
            {syncStats && (
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
                  <AlertCircle className="w-4 h-4 mr-2" /> {/* As per outline */}
                  Force Resync
                </>
              )}
            </Button>
            <Link to={createPageUrl("Settings") + "?tab=integrations"}>
              <Button variant="outline" size="sm">
                <AlertCircle className="w-4 h-4 mr-2" />
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
              {approvals.length > 0 && (
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {approvals.length} pending
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-slate-700">No pending approvals! 🎉</p>
                <p className="text-slate-500 mt-2">You're all caught up.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <Card 
                    key={approval.id} 
                    className="border-2 border-orange-200 bg-orange-50/30 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setSelectedApproval(approval)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                              <Calendar className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 text-lg">
                                {approval.event_name}
                              </h3>
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                                    {approval.resource_name}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Qty: {approval.quantity}
                                  </Badge>
                                </div>
                                {approval.event_starts_at && (
                                  <p className="text-sm text-slate-600">
                                    📅 {format(parseISO(approval.event_starts_at), 'PPP p')}
                                  </p>
                                )}
                                <p className="text-xs text-slate-500">
                                  Requested: {format(parseISO(approval.created_at), 'PPp')}
                                </p>
                                <p className="text-xs text-blue-600 font-medium mt-2">
                                  Click to view details and resource questions &rarr;
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:bg-green-50 border-green-300"
                            onClick={() => handleApprove(approval)}
                            disabled={processingApproval === approval.id}
                          >
                            {processingApproval === approval.id ? (
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
                            className="text-red-600 hover:bg-red-50 border-red-300"
                            onClick={() => handleDeny(approval)}
                            disabled={processingApproval === approval.id}
                          >
                            {processingApproval === approval.id ? (
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
                    </CardContent>
                  </Card>
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
                <Calendar className="w-5 h-5 text-blue-500" />
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
            {calendarEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No upcoming events in the next 2 weeks</p>
              </div>
            ) : (
              <ApprovalCalendar events={calendarEvents} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          open={!!selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApprove}
          onDeny={handleDeny}
          isProcessing={processingApproval === selectedApproval.id}
        />
      )}

      {/* Full Calendar Modal */}
      {showFullCalendar && (
        <FullApprovalCalendarModal
          events={calendarEvents}
          onClose={() => setShowFullCalendar(false)}
        />
      )}
    </div>
  );
}
