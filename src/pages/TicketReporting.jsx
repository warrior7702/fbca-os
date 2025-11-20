import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  Calendar,
  Download,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";

const COLORS = {
  open: '#3b82f6',
  awaiting_information: '#eab308',
  awaiting_parts: '#f97316',
  resolved: '#22c55e',
  archived: '#64748b'
};

const CATEGORY_COLORS = {
  technology: '#8b5cf6',
  cleaning: '#06b6d4',
  maintenance: '#f59e0b'
};

export default function TicketReporting() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [dateRange, setDateRange] = useState('30');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tickets, dateRange, categoryFilter, startDate, endDate]);

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

      const allTickets = await base44.entities.Ticket.list('-created_date');
      setTickets(allTickets);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tickets];

    // Date range filter
    if (dateRange === 'custom' && startDate && endDate) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      filtered = filtered.filter(t => {
        const created = new Date(t.created_date);
        return created >= start && created <= end;
      });
    } else if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoff = subDays(new Date(), days);
      filtered = filtered.filter(t => new Date(t.created_date) >= cutoff);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  };

  // Calculate metrics
  const getVolumeOverTime = () => {
    const dayGroups = {};
    filteredTickets.forEach(ticket => {
      const day = format(new Date(ticket.created_date), 'MMM d');
      dayGroups[day] = (dayGroups[day] || 0) + 1;
    });

    return Object.entries(dayGroups)
      .map(([date, count]) => ({ date, count }))
      .slice(-30);
  };

  const getStatusDistribution = () => {
    const distribution = {};
    filteredTickets.forEach(ticket => {
      const status = ticket.status || 'open';
      distribution[status] = (distribution[status] || 0) + 1;
    });

    return Object.entries(distribution).map(([name, value]) => ({
      name: name.replace('_', ' '),
      value,
      color: COLORS[name]
    }));
  };

  const getResolutionTimesByCategory = () => {
    const categories = {};
    filteredTickets
      .filter(t => t.time_to_resolution && t.category)
      .forEach(ticket => {
        if (!categories[ticket.category]) {
          categories[ticket.category] = [];
        }
        categories[ticket.category].push(ticket.time_to_resolution);
      });

    return Object.entries(categories).map(([category, times]) => ({
      category: category.replace('_', ' '),
      avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      color: CATEGORY_COLORS[category]
    }));
  };

  const getSLACompliance = () => {
    const slaThreshold = 60; // 60 minutes
    const withResponse = filteredTickets.filter(t => t.time_to_first_response);
    const withinSLA = withResponse.filter(t => t.time_to_first_response <= slaThreshold);
    
    return {
      total: withResponse.length,
      compliant: withinSLA.length,
      percentage: withResponse.length > 0 
        ? Math.round((withinSLA.length / withResponse.length) * 100) 
        : 0
    };
  };

  const getPriorityDistribution = () => {
    const distribution = {};
    filteredTickets.forEach(ticket => {
      const priority = ticket.priority || 'medium';
      distribution[priority] = (distribution[priority] || 0) + 1;
    });

    return Object.entries(distribution).map(([name, value]) => ({
      name,
      value
    }));
  };

  const exportReport = () => {
    const csvContent = [
      ['Ticket Number', 'Subject', 'Category', 'Priority', 'Status', 'Created', 'Resolved', 'Resolution Time (min)'],
      ...filteredTickets.map(t => [
        t.ticket_number,
        t.subject,
        t.category || '',
        t.priority,
        t.status,
        format(new Date(t.created_date), 'yyyy-MM-dd HH:mm'),
        t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm') : '',
        t.time_to_resolution || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const volumeData = getVolumeOverTime();
  const statusData = getStatusDistribution();
  const resolutionData = getResolutionTimesByCategory();
  const slaData = getSLACompliance();
  const priorityData = getPriorityDistribution();

  const avgResolutionTime = filteredTickets
    .filter(t => t.time_to_resolution)
    .reduce((sum, t) => sum + t.time_to_resolution, 0) / 
    (filteredTickets.filter(t => t.time_to_resolution).length || 1);

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Ticket Reporting Dashboard
              </h1>
              <p className="text-sm text-slate-600">
                Analyzing {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button onClick={exportReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{filteredTickets.length}</p>
              <p className="text-sm text-slate-600">Total Tickets</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{Math.round(avgResolutionTime)}m</p>
              <p className="text-sm text-slate-600">Avg Resolution Time</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{slaData.percentage}%</p>
              <p className="text-sm text-slate-600">SLA Compliance</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {filteredTickets.filter(t => ['open', 'awaiting_information', 'awaiting_parts'].includes(t.status)).length}
              </p>
              <p className="text-sm text-slate-600">Active Tickets</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Ticket Volume Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Volume Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Tickets" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Resolution Times by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Avg Resolution Time by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resolutionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgTime" name="Avg Time (min)">
                    {resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8b5cf6" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* SLA Compliance Details */}
        <Card>
          <CardHeader>
            <CardTitle>SLA Compliance Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                <span className="text-sm text-slate-700">Total Tickets with Response Time</span>
                <Badge variant="secondary">{slaData.total}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                <span className="text-sm text-slate-700">Within SLA (&lt; 60 min)</span>
                <Badge className="bg-green-100 text-green-700">{slaData.compliant}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                <span className="text-sm text-slate-700">Breached SLA</span>
                <Badge className="bg-red-100 text-red-700">{slaData.total - slaData.compliant}</Badge>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mt-4">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${slaData.percentage}%` }}
                />
              </div>
              <p className="text-center text-sm text-slate-600 mt-2">
                {slaData.percentage}% compliance rate
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}