import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TrendingUp,
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  BarChart3,
  PieChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function TicketAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_user') {
        toast.error('Admin access required');
        navigate(createPageUrl('SupportTickets'));
        return;
      }

      const response = await base44.functions.invoke('getTicketAnalytics');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!analytics) return null;

  const { summary, status_distribution, priority_distribution, category_distribution, tickets_by_day, top_requesters, staff_performance } = analytics;

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('SupportTickets'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              Support Ticket Analytics
            </h1>
            <p className="text-sm text-slate-600">Performance metrics and insights</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <Badge>30 days</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{summary.tickets_last_30_days}</p>
                <p className="text-sm text-slate-600">New Tickets</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <Badge className="bg-orange-100 text-orange-700">Avg</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{summary.avg_first_response_minutes}m</p>
                <p className="text-sm text-slate-600">First Response</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-700">Avg</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{summary.avg_resolution_minutes}m</p>
                <p className="text-sm text-slate-600">Resolution Time</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                  <Badge className="bg-purple-100 text-purple-700">SLA</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{summary.sla_compliance_percentage}%</p>
                <p className="text-sm text-slate-600">Compliance</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(status_distribution).map(([status, count]) => {
                  const total = Object.values(status_distribution).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-slate-700">{status.replace('_', ' ')}</span>
                        <span className="font-semibold text-slate-900">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(priority_distribution).map(([priority, count]) => {
                  const total = Object.values(priority_distribution).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                  const color = priority === 'urgent' ? 'bg-red-600' : priority === 'high' ? 'bg-orange-600' : priority === 'medium' ? 'bg-yellow-600' : 'bg-blue-600';
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-slate-700">{priority}</span>
                        <span className="font-semibold text-slate-900">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className={`${color} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(category_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm text-slate-700 capitalize">{category.replace('_', ' ')}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Requesters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Requesters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top_requesters.slice(0, 10).map((requester, idx) => (
                  <div key={requester.email} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 w-5">#{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{requester.name}</p>
                        <p className="text-xs text-slate-500">{requester.email}</p>
                      </div>
                    </div>
                    <Badge>{requester.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff Performance */}
        {staff_performance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Staff Member</th>
                      <th className="text-center p-3 text-sm font-semibold text-slate-700">Total Assigned</th>
                      <th className="text-center p-3 text-sm font-semibold text-slate-700">Resolved</th>
                      <th className="text-center p-3 text-sm font-semibold text-slate-700">Resolution Rate</th>
                      <th className="text-center p-3 text-sm font-semibold text-slate-700">Avg Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff_performance.map(staff => {
                      const resolutionRate = staff.total > 0 ? ((staff.resolved / staff.total) * 100).toFixed(1) : 0;
                      return (
                        <tr key={staff.email} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{staff.name}</p>
                              <p className="text-xs text-slate-500">{staff.email}</p>
                            </div>
                          </td>
                          <td className="text-center p-3">
                            <Badge variant="secondary">{staff.total}</Badge>
                          </td>
                          <td className="text-center p-3">
                            <Badge className="bg-green-100 text-green-700">{staff.resolved}</Badge>
                          </td>
                          <td className="text-center p-3">
                            <span className="text-sm font-semibold text-slate-900">{resolutionRate}%</span>
                          </td>
                          <td className="text-center p-3">
                            <span className="text-sm text-slate-700">
                              {staff.avg_resolution_time > 0 ? `${Math.round(staff.avg_resolution_time)}m` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}