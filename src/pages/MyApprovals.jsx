import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getApprovalsLite, approveRequest, denyRequest } from "@/lib/pcoClient.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  User
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import ConnectionWarning from "@/components/shared/ConnectionWarning";
import ApprovalCalendar from "@/components/approvals/ApprovalCalendar";
import ApprovalDetailModal from "@/components/approvals/ApprovalDetailModal";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.pco_access_token) {
      loadApprovals();
    } else if (user && !user.pco_access_token) {
      console.log('User loaded but PCO not connected');
      setLoading(false);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      console.log('User loaded:', currentUser?.email);
      console.log('Has PCO token:', !!currentUser?.pco_access_token);
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
      setLoading(false);
    }
  };

  const loadApprovals = async () => {
    if (!user?.pco_access_token) {
      console.log('PCO not connected, skipping approval load');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading approvals directly from PCO...');
      
      const response = await getApprovalsLite();
      
      console.log('✅ Raw response:', response);
      console.log('✅ Response count:', response.count);
      console.log('✅ First item:', response.data?.[0]);
      
      const transformedApprovals = (response.data || []).map(item => ({
        id: item.id,
        request_id: item.id,
        event_id: item.event?.id,
        event_name: item.event?.name || 'Unknown Event',
        event_starts_at: item.event?.starts_at,
        event_ends_at: item.event?.ends_at,
        resource_name: item.resource?.name || 'Unknown Resource',
        approval_group_name: item.approval_group?.name || 'Unknown Group',
        quantity: item.quantity || 1,
        approval_status: item.status,
        pco_created_at: item.created_at,
        pco_updated_at: item.updated_at
      }));
      
      console.log('✅ Transformed approvals:', transformedApprovals);
      setApprovals(transformedApprovals);
      
      if (transformedApprovals.length === 0) {
        console.log('ℹ️ No approvals found - you may not be in any approval groups or there are no pending requests');
      }
    } catch (error) {
      console.error("❌ Failed to load approvals:", error);
      console.error("❌ Error details:", error.message);
      setError(error.message);
      toast.error("Failed to load approvals: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval) => {
    setProcessing(approval.request_id);
    try {
      await approveRequest(approval.request_id, "Approved from FBCA Hub");
      
      toast.success('Request approved!');
      
      setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error(error.message || "Failed to approve request");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (approval) => {
    setProcessing(approval.request_id);
    try {
      await denyRequest(approval.request_id, "Denied from FBCA Hub");
      
      toast.success('Request denied');
      
      setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
    } catch (error) {
      console.error("Denial failed:", error);
      toast.error(error.message || "Failed to deny request");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-red-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Approvals</h1>
              <p className="text-slate-600">Pending resource requests</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={loadApprovals}
              disabled={loading || !user?.pco_access_token}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {!user?.pco_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <ApprovalCalendar 
                approvals={approvals}
                onApprovalClick={setSelectedApproval}
              />
            </div>

            <div className="grid gap-4">
              {approvals.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ClipboardCheck className="w-16 h-16 text-slate-300 mb-4" />
                    <p className="text-slate-600 text-lg mb-2">No pending approvals</p>
                    <p className="text-slate-500 text-sm">
                      {user?.pco_access_token 
                        ? "All caught up! New approvals will appear here."
                        : "Connect Planning Center in Settings to see approvals."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                approvals.map((approval) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="hover:shadow-lg transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold text-slate-900">
                                {approval.event_name}
                              </h3>
                              <Badge className="bg-orange-100 text-orange-700">
                                {approval.approval_group_name}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {approval.event_starts_at
                                    ? format(new Date(approval.event_starts_at), 'PPP p')
                                    : 'No date set'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span className="font-medium">{approval.resource_name}</span>
                                {approval.quantity > 1 && (
                                  <Badge variant="outline">Qty: {approval.quantity}</Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-slate-500">
                                <Clock className="w-4 h-4" />
                                <span>
                                  Requested {format(new Date(approval.pco_created_at), 'PP')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => handleApprove(approval)}
                              disabled={processing === approval.request_id}
                              className="bg-green-600 hover:bg-green-700 gap-2"
                            >
                              {processing === approval.request_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Approve
                            </Button>

                            <Button
                              onClick={() => handleDeny(approval)}
                              disabled={processing === approval.request_id}
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Deny
                            </Button>

                            <Button
                              onClick={() => setSelectedApproval(approval)}
                              variant="ghost"
                              size="sm"
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}
    </div>
  );
}