import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ApprovalDetailModal from "../components/approvals/ApprovalDetailModal";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";

export default function MyApprovals() {
  const [user, setUser] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState('list');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasConnectionAlert, setHasConnectionAlert] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      console.log('User loaded:', currentUser.email);
      console.log('Has PCO token:', !!currentUser?.pco_access_token);
      setUser(currentUser);
      
      const hasPCO = !!currentUser?.pco_access_token;
      const hasClickUp = !!currentUser?.clickup_access_token;
      const hasMicrosoft = !!currentUser?.microsoft_access_token;
      const missingConnections = !hasPCO || !hasClickUp || !hasMicrosoft;
      
      setHasConnectionAlert(missingConnections);
      
      if (hasPCO) {
        loadApprovals();
      }
    } catch (error) {
      console.error("Error loading user:", error);
      setHasConnectionAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const loadApprovals = async () => {
    try {
      console.log('🔄 Loading approvals...');
      const response = await base44.functions.invoke('getMyPendingApprovals');
      console.log('✅ Response:', response.data);
      console.log('📊 Total fetched from PCO:', response.data.total_fetched);
      console.log('📊 After filtering:', response.data.count, 'approvals');
      
      const approvalsData = response.data.pending_approvals || [];
      console.log('📅 Approvals data:', approvalsData);
      
      const pendingOnly = approvalsData.filter(a => a.approval_status === 'P');
      console.log('📋 Pending requests only:', pendingOnly.length);
      
      setApprovals(pendingOnly);
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load approvals');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Starting sync...');
      const response = await base44.functions.invoke('syncMyApprovals');
      console.log('✅ Sync response:', response.data);
      
      toast.success(`Synced ${response.data.count} approvals`);
      
      await loadApprovals();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewDetails = (approval) => {
    console.log('🔍 Opening details for:', approval);
    setSelectedApproval(approval);
    setShowDetailModal(true);
  };

  const handleApprovalComplete = () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
    loadApprovals();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

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
              <p className="text-slate-600">Review and approve pending requests</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSync}
              disabled={syncing || !user?.pco_access_token}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
              >
                List
              </Button>
              <Button
                variant={view === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('calendar')}
              >
                Calendar
              </Button>
            </div>
          </div>
        </div>

        {hasConnectionAlert && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {!user?.pco_access_token ? (
          <Alert className="border-orange-300 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-slate-700">
              Planning Center not connected. Connect in Settings to view approvals.
            </AlertDescription>
          </Alert>
        ) : view === 'calendar' ? (
          <ApprovalCalendar 
            approvals={approvals}
            onApprovalClick={handleViewDetails}
          />
        ) : (
          <div className="space-y-4">
            {approvals.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-2">
                    All caught up!
                  </p>
                  <p className="text-slate-500">
                    No pending approvals at the moment
                  </p>
                </CardContent>
              </Card>
            ) : (
              approvals.map((approval, index) => (
                <motion.div
                  key={approval.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 border-orange-200 hover:border-orange-300 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">
                            {approval.event_name}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {approval.event_starts_at
                                  ? new Date(approval.event_starts_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })
                                  : 'Date TBD'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                {approval.event_starts_at
                                  ? new Date(approval.event_starts_at).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })
                                  : 'Time TBD'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="bg-orange-100 text-orange-700">
                              {approval.resource_name}
                            </Badge>
                            <Badge variant="outline">
                              {approval.approval_group_name}
                            </Badge>
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <Clock className="w-3 h-3 mr-1" />
                              Requested {new Date(approval.pco_created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => handleViewDetails(approval)}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}

        <ApprovalDetailModal
          approval={selectedApproval}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApproval(null);
          }}
          onApprovalAction={handleApprovalComplete}
        />
      </div>
    </div>
  );
}