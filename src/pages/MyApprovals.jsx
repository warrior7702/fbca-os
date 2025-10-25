
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
  ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import FullApprovalCalendarModal from "../components/approvals/FullApprovalCalendarModal";
import { toast } from "sonner";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.pco_access_token) {
        toast.error('Please connect Planning Center in Settings');
        setLoading(false);
        return;
      }

      try {
        const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
        console.log('Approvals response:', approvalsResponse.data);
        setApprovals(approvalsResponse.data.pending_approvals || []);
      } catch (error) {
        console.error('Error fetching approvals:', error);
        toast.error('Failed to load approvals');
      }

      try {
        const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
        console.log('Calendar events response:', eventsResponse.data);
        setCalendarEvents(eventsResponse.data.events || []);
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        toast.error('Failed to load calendar events');
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval) => {
    setProcessingApproval(approval.id);
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.id
      });
      toast.success('Request approved!');
      loadData(); // Reload data
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
      loadData(); // Reload data
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
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
          <p className="text-slate-600">Welcome back, {displayName}</p>
        </div>

        {!user?.pco_access_token && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span>Planning Center is not connected. </span>
              <Link to={createPageUrl('Settings') + '?tab=integrations'} className="font-medium text-blue-600 hover:underline">
                Connect it in Settings
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Approvals List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
              <Badge variant="secondary">{approvals.length} pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No pending approvals! 🎉</p>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 mb-1">
                          {approval.event_name}
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          Resource: <span className="font-medium">{approval.resource_name}</span>
                        </p>
                        {approval.attributes?.quantity && (
                          <p className="text-xs text-slate-500">
                            Quantity: {approval.attributes.quantity}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(approval)}
                          disabled={processingApproval === approval.id}
                          className="bg-green-600 hover:bg-green-700"
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
                          onClick={() => handleDeny(approval)}
                          disabled={processingApproval === approval.id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendar - Next 2 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalCalendar 
              approvals={approvals}
              calendarEvents={calendarEvents}
              onOpenFullView={() => setShowFullCalendar(true)}
            />
          </CardContent>
        </Card>
      </div>

      <FullApprovalCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        approvals={approvals}
        calendarEvents={calendarEvents}
      />
    </div>
  );
}
