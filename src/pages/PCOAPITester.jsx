import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Loader2, Calendar, Package, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PCOAPITester() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Test inputs
  const [selectedDate, setSelectedDate] = useState('');
  const [groupId, setGroupId] = useState('');
  const [eventId, setEventId] = useState('');

  useEffect(() => {
    loadUser();
    
    // Set default date to next Sunday
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    setSelectedDate(nextSunday.toISOString().split('T')[0]);
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.role !== 'admin' && currentUser.role !== 'super_user') {
        toast.error('Access denied - Admin only');
      }
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  const makeAPICall = async (endpoint, params = {}) => {
    setTestLoading(true);
    setResult(null);
    
    try {
      console.log('🔧 Making API call:', endpoint, params);
      
      // Get PCO token
      const tokenResponse = await base44.functions.invoke('getPCOToken');
      if (!tokenResponse.data.ok) {
        throw new Error('Failed to get PCO token');
      }
      
      const token = tokenResponse.data.access_token;
      
      // Build URL with params
      const url = new URL(`https://api.planningcenteronline.com/calendar/v2${endpoint}`);
      Object.keys(params).forEach(key => {
        if (params[key]) {
          url.searchParams.append(key, params[key]);
        }
      });
      
      console.log('📞 Calling:', url.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      setResult({
        ok: response.ok,
        status: response.status,
        url: url.toString(),
        data: data
      });
      
      if (response.ok) {
        toast.success('API call successful');
      } else {
        toast.error('API call failed');
      }
    } catch (error) {
      console.error('❌ API call error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('API call failed: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  const testEventsByDate = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    
    // Convert date to ISO format with time
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);
    
    await makeAPICall('/event_instances', {
      'where[starts_at]': `${startDate.toISOString()}..${endDate.toISOString()}`,
      'per_page': '100',
      'order': 'starts_at'
    });
  };

  const testAllApprovalGroups = async () => {
    await makeAPICall('/resource_approval_groups', {
      'per_page': '100'
    });
  };

  const testResourcesInGroup = async () => {
    if (!groupId) {
      toast.error('Please enter a group ID');
      return;
    }
    
    await makeAPICall(`/resource_approval_groups/${groupId}/resources`, {
      'per_page': '100'
    });
  };

  const testEventDetails = async () => {
    if (!eventId) {
      toast.error('Please enter an event ID');
      return;
    }
    
    await makeAPICall(`/events/${eventId}`, {
      'include': 'tags'
    });
  };

  const testEventResources = async () => {
    if (!eventId) {
      toast.error('Please enter an event ID');
      return;
    }
    
    await makeAPICall(`/events/${eventId}/event_resource_requests`, {
      'include': 'resource',
      'per_page': '100'
    });
  };

  const testFutureEvents = async () => {
    await makeAPICall('/event_instances', {
      'filter': 'future',
      'per_page': '10',
      'order': 'starts_at'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
    return (
      <div className="p-8">
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Access denied. This page is only accessible to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user.pco_access_token) {
    return (
      <div className="p-8">
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-900">
            PCO not connected. Please connect Planning Center in Settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-gray-50 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
            <Bug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">PCO API Tester</h1>
            <p className="text-slate-600">Test Planning Center API endpoints</p>
          </div>
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="groups">Approval Groups</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Test Event Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Get Events by Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <Button onClick={testEventsByDate} disabled={testLoading}>
                      {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Default: Next Sunday. Will fetch all event instances for the selected date.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <Label>Get Event Details</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Event ID"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                    />
                    <Button onClick={testEventDetails} disabled={testLoading}>
                      Details
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label>Get Event Resources</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Event ID"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                    />
                    <Button onClick={testEventResources} disabled={testLoading}>
                      Resources
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Button onClick={testFutureEvents} disabled={testLoading} variant="outline" className="w-full">
                    Get Next 10 Future Events
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approval Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  Test Approval Groups
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Button onClick={testAllApprovalGroups} disabled={testLoading} className="w-full">
                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Get All Approval Groups
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-600" />
                  Test Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Get Resources in Approval Group</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Approval Group ID"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    />
                    <Button onClick={testResourcesInGroup} disabled={testLoading}>
                      {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    First get all approval groups, then use a group ID here
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Tab */}
          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Custom API Call</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Use the other tabs for common queries. Results will appear below.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>API Response</span>
                <span className={`text-sm font-mono ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {result.status || 'ERROR'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.url && (
                <div className="mb-4 p-3 bg-slate-100 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Request URL:</p>
                  <p className="text-xs font-mono break-all">{result.url}</p>
                </div>
              )}
              
              {result.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-900 font-semibold mb-2">Error:</p>
                  <p className="text-red-700 text-sm">{result.error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Found {result.data?.data?.length || 0} items
                    </p>
                    {result.data?.meta && (
                      <p className="text-xs text-blue-700">
                        Total: {result.data.meta.total_count || 'N/A'}
                      </p>
                    )}
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-slate-50 max-h-[600px] overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}