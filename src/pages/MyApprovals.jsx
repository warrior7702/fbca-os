import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, RefreshCw, Loader2, ExternalLink, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react";
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

const VERCEL_API = "https://pco-webhook.vercel.app/api";

function MyApprovalsContent() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  const safeApprovals = A(approvals);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser?.pco_access_token) {
        setError('Planning Center not connected');
        setLoading(false);
        return;
      }

      await loadMyApprovals(currentUser.pco_access_token);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMyApprovals = async (token) => {
    try {
      console.log('🔄 Fetching my approvals from Vercel API');
      
      const response = await fetch(`${VERCEL_API}/pco-my-approvals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Received approvals:', data);

      // Transform the data to match our UI format
      const transformedApprovals = A(data.events).flatMap(event => 
        A(event.requests).map(request => ({
          request_id: request.id,
          event_id: event.id,
          event_name: event.name,
          event_starts_at: event.starts_at,
          event_ends_at: event.ends_at,
          resource_name: request.resource_name,
          resource_id: request.resource_id,
          approval_group_name: request.approval_group_name,
          quantity: request.quantity || 1,
          approval_status: request.status,
          pco_created_at: request.created_at,
          pco_updated_at: request.updated_at
        }))
      );
      
      setApprovals(transformedApprovals);
      
      // Build calendar events
      const events = A(data.events).map(event => ({
        id: event.id,
        title: event.name,
        start: event.starts_at,
        end: event.ends_at,
        extendedProps: { 
          requestCount: A(event.requests).length,
          requests: event.requests
        }
      }));
      
      setCalendarEvents(events);

      toast.success(`Loaded ${transformedApprovals.length} pending approvals`);
      
    } catch (error) {
      console.error('❌ Load error:', error);
      setError(error.message);
      toast.error(`Failed to load: ${error.message}`);
    }
  };

  const handleApprove = async (approval) => {
    if (!user?.pco_access_token) {
      toast.error('Not connected to Planning Center');
      return;
    }

    console.log('🔵 Approve clicked for:', approval.request_id);
    console.log('🔵 Token available:', !!user.pco_access_token);

    const confirmed = window.confirm(
      `Approve this request?\n\n` +
      `Event: ${approval.event_name}\n` +
      `Resource: ${approval.resource_name}\n` +
      `Date: ${approval.event_starts_at ? format(new Date(approval.event_starts_at), 'PPP') : 'N/A'}`
    );

    if (!confirmed) return;
    
    setProcessingIds(prev => new Set(prev).add(approval.request_id));
    
    try {
      console.log('✅ Sending approve request to Vercel API');
      console.log('Request ID:', approval.request_id);
      console.log('API URL:', `${VERCEL_API}/pco-approve`);
      
      const response = await fetch(`${VERCEL_API}/pco-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.pco_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: approval.request_id,
          action: 'approve',
          note: 'Approved via FBCA OS'
        })
      });

      console.log('Response status:', response.status);
      const responseData = await response.json().catch(() => ({}));
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to approve (${response.status})`);
      }

      toast.success('Request approved!');
      
      // Remove from local state
      setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
      
      // Reload fresh data
      setTimeout(() => loadMyApprovals(user.pco_access_token), 1000);
      
    } catch (error) {
      console.error('❌ Approve error:', error);
      toast.error(`Failed to approve: ${error.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(approval.request_id);
        return newSet;
      });
    }
  };

  const handleDeny = async (approval) => {
    if (!user?.pco_access_token) {
      toast.error('Not connected to Planning Center');
      return;
    }

    console.log('🔴 Deny clicked for:', approval.request_id);

    const confirmed = window.confirm(
      `Deny this request?\n\n` +
      `Event: ${approval.event_name}\n` +
      `Resource: ${approval.resource_name}`
    );

    if (!confirmed) return;
    
    setProcessingIds(prev => new Set(prev).add(approval.request_id));
    
    try {
      console.log('❌ Sending deny request to Vercel API');
      
      const response = await fetch(`${VERCEL_API}/pco-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.pco_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: approval.request_id,
          action: 'deny',
          note: 'Denied via FBCA OS'
        })
      });

      console.log('Response status:', response.status);
      const responseData = await response.json().catch(() => ({}));
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to deny (${response.status})`);
      }

      toast.success('Request denied');
      
      // Remove from local state
      setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
      
      // Reload fresh data
      setTimeout(() => loadMyApprovals(user.pco_access_token), 1000);
      
    } catch (error) {
      console.error('❌ Deny error:', error);
      toast.error(`Failed to deny: ${error.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(approval.request_id);
        return newSet;
      });
    }
  };

  const handleRefresh = () => {
    if (user?.pco_access_token) {
      loadMyApprovals(user.pco_access_token);
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
              onClick={handleRefresh}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
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

          {safeApprovals.map((approval) => {
            const isProcessing = processingIds.has(approval.request_id);
            
            return (
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

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://calendar.planningcenteronline.com/`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View in PCO
                      </Button>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(approval)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeny(approval)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-1" />
                          )}
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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