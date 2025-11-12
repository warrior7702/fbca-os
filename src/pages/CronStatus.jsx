import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Activity,
  Zap,
  TrendingUp,
  Calendar,
  PlayCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function CronStatus() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_executions: 0,
    successful: 0,
    failed: 0,
    last_run: null,
    avg_execution_time: 0,
    total_requests_created: 0,
    total_emails_sent: 0
  });

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Load last 50 executions
      const executionLogs = await base44.entities.CronExecutionLog.list('-created_date', 50);
      
      setLogs(executionLogs);

      // Calculate stats
      const total = executionLogs.length;
      const successful = executionLogs.filter(l => l.status === 'success').length;
      const failed = executionLogs.filter(l => l.status === 'failed').length;
      const lastRun = executionLogs.length > 0 ? executionLogs[0].created_date : null;
      
      const completedLogs = executionLogs.filter(l => l.execution_time_ms);
      const avgTime = completedLogs.length > 0
        ? Math.round(completedLogs.reduce((sum, l) => sum + (l.execution_time_ms || 0), 0) / completedLogs.length)
        : 0;

      const totalRequests = executionLogs.reduce((sum, l) => sum + (l.new_requests_created || 0), 0);
      const totalEmails = executionLogs.reduce((sum, l) => sum + (l.emails_sent || 0), 0);

      setStats({
        total_executions: total,
        successful,
        failed,
        last_run: lastRun,
        avg_execution_time: avgTime,
        total_requests_created: totalRequests,
        total_emails_sent: totalEmails
      });

    } catch (error) {
      console.error('Error loading cron logs:', error);
      toast.error('Failed to load cron logs');
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      toast.info('🔄 Triggering sync manually...');
      
      const result = await base44.functions.invoke('scheduledMysteryResourceSync');
      
      console.log('Manual trigger result:', result);
      
      if (result.data.success) {
        toast.success(`✅ Sync completed! Created ${result.data.sync_result?.new_requests_created || 0} requests, sent ${result.data.sync_result?.emails_sent || 0} emails`);
      } else {
        toast.error('Sync failed: ' + (result.data.error || 'Unknown error'));
      }
      
      // Reload logs after a short delay
      setTimeout(() => {
        loadLogs();
      }, 1000);
      
    } catch (error) {
      console.error('Manual trigger error:', error);
      toast.error('Failed to trigger sync: ' + error.message);
    } finally {
      setTriggering(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'started': return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700 border-green-300';
      case 'failed': return 'bg-red-100 text-red-700 border-red-300';
      case 'started': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Cron Status Monitor</h1>
              <p className="text-slate-600">Mystery Resource Auto-Sync Logs</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleManualTrigger} 
              disabled={triggering}
              className="bg-green-600 hover:bg-green-700"
            >
              {triggering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Trigger Now
                </>
              )}
            </Button>
            <Button onClick={loadLogs} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700">{stats.total_executions}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.total_executions}</p>
              <p className="text-sm text-slate-600">Total Executions</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-700">{stats.successful}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.successful}</p>
              <p className="text-sm text-slate-600">Successful</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200 bg-red-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <Badge className="bg-red-100 text-red-700">{stats.failed}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.failed}</p>
              <p className="text-sm text-slate-600">Failed</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-purple-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-700">{stats.avg_execution_time}ms</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.avg_execution_time}ms</p>
              <p className="text-sm text-slate-600">Avg Time</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-2 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Last Run</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {stats.last_run ? formatDistanceToNow(new Date(stats.last_run), { addSuffix: true }) : 'Never'}
                  </p>
                  {stats.last_run && (
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(stats.last_run), 'PPp')}
                    </p>
                  )}
                </div>
                <Clock className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Requests Created</p>
                  <p className="text-lg font-semibold text-slate-900">{stats.total_requests_created}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Emails Sent</p>
                  <p className="text-lg font-semibold text-slate-900">{stats.total_emails_sent}</p>
                </div>
                <Zap className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Diagnostic Info */}
        {logs.length === 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-2">⚠️ No Cron Executions Logged</h3>
                  <p className="text-sm text-yellow-800 mb-3">
                    The cron has never run OR it's not configured to log executions yet.
                  </p>
                  <div className="space-y-2 text-sm text-yellow-900">
                    <p><strong>Possible reasons:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Cron schedule is not configured in Vercel/deployment</li>
                      <li>Cron secret doesn't match (authorization failing)</li>
                      <li>This is a fresh deployment and cron hasn't run yet</li>
                      <li>The updated function hasn't been deployed yet</li>
                    </ul>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-lg border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-900 mb-2">🧪 TEST IT NOW:</p>
                    <p className="text-xs text-yellow-800 mb-3">
                      Click the <strong>"Trigger Now"</strong> button above to manually run the sync and see if it works!
                    </p>
                    <p className="text-xs text-yellow-700">
                      If manual trigger works but automatic doesn't → cron schedule issue<br/>
                      If manual trigger fails → function/code issue
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Execution Logs */}
        {logs.length > 0 && (
          <Card className="border-2 border-slate-200">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base font-medium">Execution History</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {logs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-white rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(log.status)}>
                              {log.status.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {format(new Date(log.created_date), 'PPp')}
                          </p>
                        </div>
                      </div>
                      {log.execution_time_ms && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          {log.execution_time_ms}ms
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Triggered By</p>
                        <p className="font-medium text-slate-900 truncate" title={log.trigger_source}>
                          {log.trigger_source || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Events Checked</p>
                        <p className="font-medium text-slate-900">{log.events_checked || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Requests Created</p>
                        <p className="font-medium text-slate-900">{log.new_requests_created || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Emails Sent</p>
                        <p className="font-medium text-slate-900">{log.emails_sent || 0}</p>
                      </div>
                    </div>

                    {log.synced_by_email && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                          Synced by: <span className="font-medium text-slate-700">{log.synced_by_email}</span>
                        </p>
                      </div>
                    )}

                    {log.error_message && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs font-semibold text-red-900 mb-1">❌ Error:</p>
                        <p className="text-xs text-red-700 mb-2">{log.error_message}</p>
                        {log.error_stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-red-600 cursor-pointer hover:text-red-700">
                              View Stack Trace
                            </summary>
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 overflow-x-auto">
                              {log.error_stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}

                    {log.result_details && (
                      <details className="mt-3">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                          View Full Result
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 overflow-x-auto">
                          {JSON.stringify(log.result_details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}