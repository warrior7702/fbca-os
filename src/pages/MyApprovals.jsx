import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, RefreshCw, Loader2, ExternalLink, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import FullApprovalCalendarModal from "../components/approvals/FullApprovalCalendarModal";

const A = (x) => Array.isArray(x) ? x : [];

function MyApprovalsContent() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const safeApprovals = A(approvals);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.pco_access_token) {
        setError('Planning Center not connected');
        setLoading(false);
        return;
      }

      await performSync();
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const performSync = async () => {
    setSyncing(true);
    setError(null);
    
    try {
      console.log('🔄 Starting sync');
      
      const response = await base44.functions.invoke('syncMyApprovals', {});

      console.log('✅ Sync response:', response.data);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const syncedApprovals = A(response.data.pending_approvals);
      
      setApprovals(syncedApprovals);
      
      // Build calendar events
      const events = syncedApprovals.map(approval => ({
        id: approval.request_id,
        title: approval.event_name,
        start: approval.event_starts_at,
        end: approval.event_ends_at,
        extendedProps: { approval }
      }));
      
      setCalendarEvents(events);

      toast.success(`Synced ${syncedApprovals.length} pending approvals`);
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      setError(error.message);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-slate-50 overflow-auto">
      <AppHeader
        title="My Approvals"
        subtitle="Pending resource requests for your approval"
        icon={Calendar}
        iconColor="text-orange-600"
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && (
          <ConnectionWarning />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900">{safeApprovals.length}</div>
              <div className="text-sm text-slate-600">Pending</div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={performSync}
              disabled={syncing}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Calendar Preview */}
        {calendarEvents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Calendar View</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullCalendar(true)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Full Calendar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ApprovalCalendar events={calendarEvents} height={300} />
            </CardContent>
          </Card>
        )}

        {/* Approvals List */}
        <div className="space-y-3">
          {safeApprovals.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No pending approvals</p>
                <p className="text-sm text-slate-500 mt-1">
                  All caught up! New approvals will appear here.
                </p>
              </CardContent>
            </Card>
          )}

          {safeApprovals.map((approval) => (
            <Card key={approval.request_id} className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {approval.event_name}
                      </h3>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        Pending
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {approval.event_starts_at
                            ? format(new Date(approval.event_starts_at), 'PPP p')
                            : 'Date TBD'}
                        </span>
                      </div>

                      <div>
                        <span className="font-medium">Resource:</span> {approval.resource_name}
                        {approval.quantity > 1 && ` (×${approval.quantity})`}
                      </div>

                      <div>
                        <span className="font-medium">Group:</span> {approval.approval_group_name}
                      </div>

                      {approval.pco_created_at && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          Requested {format(new Date(approval.pco_created_at), 'PPP')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://calendar.planningcenteronline.com/`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View in PCO
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {showFullCalendar && (
        <FullApprovalCalendarModal
          events={calendarEvents}
          onClose={() => setShowFullCalendar(false)}
        />
      )}
    </div>
  );
}

export default function MyApprovals() {
  return <MyApprovalsContent />;
}