
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
  const [errorMessage, setErrorMessage] = useState(null); // Added errorMessage state

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null); // Clear previous error messages
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.pco_access_token) {
        setErrorMessage('Planning Center is not connected. Please connect it in Settings > Integrations.');
        setLoading(false);
        return;
      }

      try {
        const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
        console.log('Approvals response:', approvalsResponse.data);
        
        if (approvalsResponse.data.error) {
          setErrorMessage(approvalsResponse.data.error);
          toast.error(approvalsResponse.data.error);
        } else {
          setApprovals(approvalsResponse.data.pending_approvals || []);
          
          if (approvalsResponse.data.message) {
            toast.info(approvalsResponse.data.message);
          }
        }
      } catch (error) {
        console.error('Error fetching approvals:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Failed to load approvals';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }

      try {
        const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
        console.log('Calendar events response:', eventsResponse.data);
        
        if (eventsResponse.data.error) {
          toast.error(eventsResponse.data.error); // Toast for calendar specific errors
        } else {
          setCalendarEvents(eventsResponse.data.events || []);
        }
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        toast.error('Failed to load calendar events');
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setErrorMessage('Failed to load data. Please try again.');
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

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage}
              {errorMessage.includes('not connected') && (
                <>
                  {' '}
                  <Link to={createPageUrl('Settings') + '?tab=integrations'} className="font-medium underline">
                    Go to Settings
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Removed the redundant non-destructive PCO connection alert, as errorMessage now handles it */}

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
