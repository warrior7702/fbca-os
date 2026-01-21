import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Key,
  User,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ApprovalCalendar from "../components/approvals/ApprovalCalendar";
import ConnectionWarning from "../components/shared/ConnectionWarning";

const AppHeader = ({ icon: Icon, title, description, iconColor, action }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${iconColor}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <div className="text-slate-600">{description}</div>
      </div>
    </div>
    {action}
  </div>
);

const FullApprovalCalendarModal = ({ isOpen, onClose, approvals }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full h-[90vh] shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Approval Calendar</h2>
        <div className="flex-grow overflow-hidden">
          <ApprovalCalendar
            approvals={approvals}
            onApprovalClick={(approval) => {
              window.open('https://calendar.planningcenteronline.com/approvals', '_blank');
            }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default function MyApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sendingCode, setSendingCode] = useState(null);
  const [userGroups, setUserGroups] = useState([]);

  const getGroupColor = (groupName) => {
    const name = groupName?.toLowerCase() || '';

    if (name.includes('building') || name.includes('access')) {
      return {
        border: 'border-blue-300',
        bg: 'bg-blue-50',
        badge: 'bg-blue-100 text-blue-700',
        icon: 'text-blue-600'
      };
    }

    if (name.includes('technology') || name.includes('it') || name.includes('equipment')) {
      return {
        border: 'border-purple-300',
        bg: 'bg-purple-50',
        badge: 'bg-purple-100 text-purple-700',
        icon: 'text-purple-600'
      };
    }

    if (name.includes('av') || name.includes('audio') || name.includes('visual') || name.includes('production')) {
      return {
        border: 'border-green-300',
        bg: 'bg-green-50',
        badge: 'bg-green-100 text-green-700',
        icon: 'text-green-600'
      };
    }

    if (name.includes('kitchen') || name.includes('food') || name.includes('catering')) {
      return {
        border: 'border-orange-300',
        bg: 'bg-orange-50',
        badge: 'bg-orange-100 text-orange-700',
        icon: 'text-orange-600'
      };
    }

    if (name.includes('vehicle') || name.includes('transport')) {
      return {
        border: 'border-cyan-300',
        bg: 'bg-cyan-50',
        badge: 'bg-cyan-100 text-cyan-700',
        icon: 'text-cyan-600'
      };
    }

    return {
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      badge: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600'
    };
  };

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !syncing) {
        console.log('👁️ Page became visible - auto-syncing...');
        handleSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncing]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadApprovals = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      const response = await fetch(
        'https://pco-webhook.vercel.app/api/cron/pco-sync?approvals=1&windowDays=30&maxEvents=100'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('📊 Total approvals from API:', (data.approvals || []).length);
      console.log('👤 User email:', currentUser.email);
      
      // Extract unique approval groups from the data
      const allGroups = [...new Set((data.approvals || []).map(a => a.approvalGroupName).filter(Boolean))];
      console.log('📋 All approval groups in data:', allGroups);
      setUserGroups(allGroups);
      
      // Group by event for better UI
      const groupedByEvent = (data.approvals || []).reduce((acc, approval) => {
        if (!acc[approval.eventId]) {
          acc[approval.eventId] = {
            eventId: approval.eventId,
            eventName: approval.eventName,
            eventStartsAt: approval.eventStartsAt,
            eventEndsAt: approval.eventEndsAt,
            items: []
          };
        }
        acc[approval.eventId].items.push(approval);
        return acc;
      }, {});
      
      setApprovals(Object.values(groupedByEvent));
      setLastSync(new Date());
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        'https://pco-webhook.vercel.app/api/cron/pco-sync?approvals=1&windowDays=30&maxEvents=100'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Group by event
      const groupedByEvent = (data.approvals || []).reduce((acc, approval) => {
        if (!acc[approval.eventId]) {
          acc[approval.eventId] = {
            eventId: approval.eventId,
            eventName: approval.eventName,
            eventStartsAt: approval.eventStartsAt,
            eventEndsAt: approval.eventEndsAt,
            items: []
          };
        }
        acc[approval.eventId].items.push(approval);
        return acc;
      }, {});
      
      const approvalsList = Object.values(groupedByEvent);
      const totalCount = (data.approvals || []).length;
      
      console.log('📊 Total approvals from API:', totalCount);
      const allGroups = [...new Set((data.approvals || []).map(a => a.approvalGroupName).filter(Boolean))];
      console.log('📋 All approval groups:', allGroups);
      setUserGroups(allGroups);
      
      toast.success(`Synced ${totalCount} pending approval${totalCount !== 1 ? 's' : ''}`);
      setApprovals(approvalsList);
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync approvals');
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (resourceRequestId, eventId) => {
    try {
      setSendingCode(resourceRequestId);
      
      const response = await fetch(
        `https://pco-webhook.vercel.app/api/cron/pco-sync?approve=1&resourceRequestId=${resourceRequestId}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        // Remove approved item from state
        setApprovals(prev => 
          prev.map(event => ({
            ...event,
            items: event.items.filter(item => item.resourceRequestId !== resourceRequestId)
          }))
          .filter(event => event.items.length > 0)
        );
        
        toast.success('Approved successfully!');
      } else {
        toast.error('Failed to approve: ' + (result.response?.errors?.[0]?.detail || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setSendingCode(null);
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

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-red-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.pco_access_token && <ConnectionWarning />}

        <AppHeader
          icon={ClipboardCheck}
          title="My Approvals"
          description={
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span>{approvals.reduce((sum, event) => sum + event.items.length, 0)} pending approval{approvals.reduce((sum, event) => sum + event.items.length, 0) !== 1 ? 's' : ''}</span>
                {lastSync && (
                  <span className="text-xs text-slate-500">
                    • Last synced: {format(lastSync, 'h:mm a')}
                  </span>
                )}
              </div>
              {userGroups.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-slate-500">Your groups:</span>
                  {userGroups.map((group) => (
                    <Badge key={group} variant="outline" className="text-xs">
                      {group}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          }
          iconColor="from-orange-500 to-red-500"
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowCalendar(true)} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                size="sm"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync from PCO
                  </>
                )}
              </Button>
            </div>
          }
        />

        <div className="space-y-4">
          <AnimatePresence>
            {approvals.length === 0 || approvals.every(event => event.items.length === 0) ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-600 text-center max-w-md">
                      No pending approvals at the moment. Check back later or sync to refresh.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              approvals.map((eventGroup) => {
                const colors = getGroupColor('default');
                
                return (
                  <motion.div
                    key={eventGroup.eventId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`border-2 rounded-lg ${colors.border} ${colors.bg} hover:shadow-lg transition-all`}
                  >
                    <Card className="border-0 bg-transparent">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{eventGroup.eventName}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <div className="flex items-center gap-1">
                                <Calendar className={`w-4 h-4 ${colors.icon}`} />
                                {eventGroup.eventStartsAt ? format(parseISO(eventGroup.eventStartsAt), 'EEE, MMM d, yyyy') : 'Date not set'}
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <Clock className={`w-4 h-4 ${colors.icon}`} />
                                {eventGroup.eventStartsAt ? format(parseISO(eventGroup.eventStartsAt), 'h:mm a') : 'Time not set'}
                              </div>
                            </div>
                          </div>
                          <Badge className={`${colors.badge} flex items-center gap-1`}>
                            <AlertCircle className="w-3 h-3" />
                            {eventGroup.items.length} Pending
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {eventGroup.items.map((item) => (
                          <div 
                            key={item.resourceRequestId}
                            className="p-3 bg-white/60 rounded-lg border border-slate-200"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-4 h-4 ${colors.icon}`} />
                                <span className="font-medium text-slate-900">{item.resourceName}</span>
                                {item.type === 'room' && <span className="text-xs">🏢</span>}
                                {item.type === 'resource' && <span className="text-xs">📦</span>}
                              </div>
                              <Badge className={colors.badge} variant="outline">
                                Qty: {item.quantity}
                              </Badge>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <Button
                                onClick={() => handleApprove(item.resourceRequestId, eventGroup.eventId)}
                                disabled={sendingCode === item.resourceRequestId}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                size="sm"
                              >
                                {sendingCode === item.resourceRequestId ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Approve
                              </Button>
                              <Button
                                onClick={() => window.open('https://calendar.planningcenteronline.com/approvals', '_blank')}
                                variant="outline"
                                size="sm"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      <FullApprovalCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        approvals={approvals.flatMap(event => event.items.map(item => ({
          ...item,
          event_name: event.eventName,
          event_starts_at: event.eventStartsAt,
          event_ends_at: event.eventEndsAt,
          request_id: item.resourceRequestId,
          resource_name: item.resourceName
        })))}
      />
    </div>
  );
}