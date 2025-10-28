import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load from Base44 database
      const currentUser = await base44.auth.me();
      const data = await base44.entities.PendingApproval.filter({
        user_email: currentUser.email,
        approval_status: 'P'
      });
      
      setApprovals(data || []);
    } catch (error) {
      console.error("Failed to load approvals:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncFromPCO = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncMyApprovals');
      
      if (response.data.success) {
        toast.success(`Synced ${response.data.count} pending approvals`);
        await loadApprovals();
      } else {
        throw new Error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error(error.message || "Failed to sync approvals");
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (approval) => {
    setProcessing(approval.request_id);
    try {
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });

      if (response.data.success) {
        toast.success('Request approved!');
        
        // Remove from local state
        setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
        
        // Delete from database
        await base44.entities.PendingApproval.delete(approval.id);
      } else {
        throw new Error('Approval failed');
      }
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error("Failed to approve request");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (approval) => {
    setProcessing(approval.request_id);
    try {
      const response = await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.request_id
      });

      if (response.data.success) {
        toast.success('Request denied');
        
        // Remove from local state
        setApprovals(prev => prev.filter(a => a.request_id !== approval.request_id));
        
        // Delete from database
        await base44.entities.PendingApproval.delete(approval.id);
      } else {
        throw new Error('Denial failed');
      }
    } catch (error) {
      console.error("Denial failed:", error);
      toast.error("Failed to deny request");
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
              onClick={syncFromPCO}
              disabled={syncing || !user?.pco_access_token}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from PCO'}
            </Button>
            <Button onClick={loadApprovals} variant="outline" size="icon">
              <RefreshCw className="w-4 h-4" />
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
                    <p className="text-slate-500 text-sm">All caught up! New approvals will appear here.</p>
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