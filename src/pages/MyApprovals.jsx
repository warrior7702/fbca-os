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
        toast.error('Planning Center is not connected. Please connect it in Settings > Integrations.');
        setLoading(false);
        return;
      }

      // Load approvals and calendar events in parallel
      const [approvalsResponse, eventsResponse] = await Promise.all([
        base44.functions.invoke('getMyPendingApprovals').catch(err => {
          console.error('Approvals error:', err);
          toast.error('Failed to load approvals');
          return { data: { pending_approvals: [] } };
        }),
        base44.functions.invoke('getPCOCalendarEvents').catch(err => {
          console.error('Calendar error:', err);
          toast.error('Failed to load calendar events');
          return { data: { events: [] } };
        })
      ]);

      setApprovals(approvalsResponse.data.pending_approvals || []);
      setCalendarEvents(eventsResponse.data.events || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error('Failed to load data. Please try again.');
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
      loadData();
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
      loadData();
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
          </div>
          <Link to={createPageUrl("Settings") + "?tab=integrations"}>
            <Button variant="outline" size="sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              Manage Integrations
            </Button>
          </Link>
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
                  <Card key={approval.id} className="border-2 border-orange-200 bg-orange-50/30">
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
                                <div className="flex items-center gap-2">
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
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
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