import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Play, Pause, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EmailPollingService({ user }) {
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(10); // minutes
  const [lastPoll, setLastPoll] = useState(null);
  const [nextPoll, setNextPoll] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState(null);
  const intervalRef = useRef(null);
  const nextPollTimerRef = useRef(null);

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('emailPollingEnabled');
    const savedInterval = localStorage.getItem('emailPollingInterval');
    const savedLastPoll = localStorage.getItem('emailPollingLastRun');
    
    if (saved === 'true') {
      setIsPolling(true);
    }
    if (savedInterval) {
      setPollInterval(parseInt(savedInterval));
    }
    if (savedLastPoll) {
      setLastPoll(new Date(savedLastPoll));
    }
  }, []);

  // Start/stop polling
  useEffect(() => {
    if (isPolling && user?.microsoft_access_token) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isPolling, pollInterval, user?.microsoft_access_token]);

  const startPolling = () => {
    console.log('🔄 Starting email polling service...');
    
    // Clear any existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (nextPollTimerRef.current) {
      clearInterval(nextPollTimerRef.current);
    }

    // Run immediately
    processEmails();

    // Set up recurring interval
    const intervalMs = pollInterval * 60 * 1000;
    intervalRef.current = setInterval(() => {
      processEmails();
    }, intervalMs);

    // Update next poll time every second
    updateNextPollTime();
    nextPollTimerRef.current = setInterval(updateNextPollTime, 1000);

    toast.success(`Email polling started (every ${pollInterval} min)`);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (nextPollTimerRef.current) {
      clearInterval(nextPollTimerRef.current);
      nextPollTimerRef.current = null;
    }
    setNextPoll(null);
    console.log('⏸️ Email polling service stopped');
  };

  const updateNextPollTime = () => {
    if (lastPoll) {
      const next = new Date(lastPoll.getTime() + (pollInterval * 60 * 1000));
      setNextPoll(next);
    }
  };

  const processEmails = async () => {
    if (processing) {
      console.log('⏭️ Skipping - already processing');
      return;
    }

    setProcessing(true);
    console.log('📧 Processing service emails...');

    try {
      const response = await base44.functions.invoke('processServiceEmails');
      
      if (response.data.success) {
        const { summary } = response.data;
        setStats(summary);
        setLastPoll(new Date());
        localStorage.setItem('emailPollingLastRun', new Date().toISOString());

        if (summary.tickets_created > 0) {
          toast.success(
            `Created ${summary.tickets_created} ticket(s) from emails`,
            { duration: 5000 }
          );
        }

        console.log('✅ Email processing complete:', summary);
      }
    } catch (error) {
      console.error('❌ Email processing error:', error);
      toast.error('Failed to process emails: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggle = (enabled) => {
    setIsPolling(enabled);
    localStorage.setItem('emailPollingEnabled', enabled.toString());
    
    if (!enabled) {
      toast.info('Email polling disabled');
    }
  };

  const handleIntervalChange = (value) => {
    const newInterval = parseInt(value);
    setPollInterval(newInterval);
    localStorage.setItem('emailPollingInterval', newInterval.toString());
    
    // Restart polling with new interval if currently running
    if (isPolling) {
      toast.info(`Polling interval updated to ${newInterval} minutes`);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTimeUntil = (date) => {
    if (!date) return 'Unknown';
    
    const seconds = Math.floor((date - new Date()) / 1000);
    
    if (seconds < 0) return 'Now';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (!user?.microsoft_access_token) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900">
            <AlertCircle className="w-5 h-5" />
            Microsoft 365 Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-800">
            Connect Microsoft 365 to enable automatic email processing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Automatic Email Processing
            </CardTitle>
            <CardDescription className="mt-2">
              Automatically check service inboxes and create tickets from emails
            </CardDescription>
          </div>
          <Badge variant={isPolling ? "default" : "secondary"}>
            {isPolling ? (
              <>
                <Play className="w-3 h-3 mr-1" />
                Active
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Paused
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Switch
              id="polling-enabled"
              checked={isPolling}
              onCheckedChange={handleToggle}
            />
            <Label htmlFor="polling-enabled" className="cursor-pointer">
              <span className="font-medium">Enable Automatic Processing</span>
              <p className="text-sm text-slate-500 mt-1">
                Keep this browser tab open for continuous monitoring
              </p>
            </Label>
          </div>
        </div>

        {/* Interval Selection */}
        <div className="space-y-2">
          <Label>Check Interval</Label>
          <Select value={pollInterval.toString()} onValueChange={handleIntervalChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Every 5 minutes</SelectItem>
              <SelectItem value="10">Every 10 minutes</SelectItem>
              <SelectItem value="15">Every 15 minutes</SelectItem>
              <SelectItem value="30">Every 30 minutes</SelectItem>
              <SelectItem value="60">Every hour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Last Check</span>
            </div>
            <p className="text-sm font-medium text-slate-900">
              {formatTimeAgo(lastPoll)}
            </p>
          </div>

          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Next Check</span>
            </div>
            <p className="text-sm font-medium text-slate-900">
              {isPolling ? formatTimeUntil(nextPoll) : 'Paused'}
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm text-slate-700">Last Run Statistics</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.total_processed}</p>
                <p className="text-xs text-slate-500">Processed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.tickets_created}</p>
                <p className="text-xs text-slate-500">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{stats.emails_skipped}</p>
                <p className="text-xs text-slate-500">Filtered</p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Trigger */}
        <div className="pt-4 border-t">
          <Button
            onClick={processEmails}
            disabled={processing || !user?.microsoft_access_token}
            className="w-full"
            variant="outline"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Check Emails Now
              </>
            )}
          </Button>
        </div>

        {/* Monitored Inboxes */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Monitored Inboxes</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-slate-600">maintenance@fbca.org</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-slate-600">support@fbca.org</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-slate-600">cleaning@fbca.org</span>
            </div>
          </div>
        </div>

        {isPolling && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Keep this browser tab open in the background for automatic monitoring. 
              The service will continue checking emails at the configured interval.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}