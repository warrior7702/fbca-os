
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Loader2, Calendar, Package, Users, AlertCircle, CheckCircle, XCircle, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function PCOAPITester() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Test inputs
  const [selectedDate, setSelectedDate] = useState('');
  const [groupId, setGroupId] = useState('');
  const [eventId, setEventId] = useState('');
  const [lookupUserId, setLookupUserId] = useState('3566727'); // Pre-fill with mystery ID
  
  // NEW: Store the filter date separately (not sent to PCO)
  const [clientFilterDate, setClientFilterDate] = useState(null);

  // NEW: Add state for detailed test result
  const [detailedTestResult, setDetailedTestResult] = useState(null);

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

  const makeAPICall = async (endpoint, params = {}, filterDate = null) => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null); // Clear detailed results on new API call
    setClientFilterDate(filterDate); // Store filter date for client-side filtering
    
    try {
      console.log('🔧 Making API call:', endpoint, params);
      
      // Get PCO token
      const tokenResponse = await base44.functions.invoke('getPCOToken');
      if (!tokenResponse.data.ok) {
        throw new Error('Failed to get PCO token');
      }
      
      const token = tokenResponse.data.access_token;
      
      // Build URL with params (filterDate NOT included in URL)
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
      
      // If we're fetching events, also fetch resources for each event
      if (endpoint === '/event_instances' && response.ok && data.data) {
        console.log('📦 Fetching resources for', data.data.length, 'events...');
        
        // Get unique event IDs
        const eventIds = [...new Set(data.data.map(instance => 
          instance.relationships?.event?.data?.id
        ).filter(Boolean))];
        
        console.log('📋 Unique event IDs:', eventIds.length);
        
        // Fetch resources for each event (limit to first 20 events to avoid too many requests)
        const eventsWithResources = await Promise.all(
          eventIds.slice(0, 20).map(async (eventId) => {
            try {
              const resourcesUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`;
              const resourcesResponse = await fetch(resourcesUrl, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                return {
                  eventId,
                  resources: resourcesData.data || [],
                  included: resourcesData.included || []
                };
              }
              return { eventId, resources: [], included: [] };
            } catch (error) {
              console.error('Error fetching resources for event', eventId, error);
              return { eventId, resources: [], included: [] };
            }
            // Add a small delay to avoid hitting rate limits too hard if there are many events
            // await new Promise(resolve => setTimeout(resolve, 100)); 
          })
        );
        
        // Store resources data alongside the main data
        data._resourcesData = eventsWithResources;
        console.log('✅ Fetched resources for', eventsWithResources.length, 'events');
      }
      
      setResult({
        ok: response.ok,
        status: response.status,
        url: url.toString(),
        data: data,
        endpoint: endpoint
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
    
    console.log('📅 Fetching all future events to filter by date:', selectedDate);
    
    // PCO doesn't support date range filters well, so fetch all future events
    // Pass the date separately for client-side filtering (NOT in URL params)
    await makeAPICall('/event_instances', {
      'filter': 'future',
      'per_page': '100',
      'order': 'starts_at'
    }, selectedDate); // Pass filter date as separate parameter
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

  const testGetMyApprovals = async () => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('📋 Fetching my pending approvals...');
      const response = await base44.functions.invoke('getMyPendingApprovals');
      
      setResult({
        ok: true,
        status: 200,
        data: response.data,
        endpoint: 'getMyPendingApprovals'
      });
      
      toast.success('Approvals fetched');
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to fetch approvals');
    } finally {
      setTestLoading(false);
    }
  };

  const testApproveRequest = async () => {
    if (!eventId) {
      toast.error('Please enter a request ID');
      return;
    }
    
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('✅ Approving request:', eventId);
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: eventId,
        action: 'approve'
      });
      
      setResult({
        ok: response.data.ok !== false,
        status: 200,
        data: response.data,
        endpoint: 'approveResourceRequest'
      });
      
      if (response.data.ok !== false) {
        toast.success('Request approved!');
      } else {
        toast.error(response.data.error || 'Approval failed');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to approve: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  const testDenyRequest = async () => {
    if (!eventId) {
      toast.error('Please enter a request ID');
      return;
    }
    
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('❌ Denying request:', eventId);
      const response = await base44.functions.invoke('denyResourceRequest', {
        request_id: eventId
      });
      
      setResult({
        ok: response.data.success || response.data.ok,
        status: 200,
        data: response.data,
        endpoint: 'denyResourceRequest'
      });
      
      if (response.data.success || response.data.ok) {
        toast.success('Request denied');
      } else {
        toast.error(response.data.error || 'Denial failed');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to deny: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Force approve with user 149670080
  const testForceApproveAs149670080 = async () => {
    if (!eventId) {
      toast.error('Please enter a request ID');
      return;
    }
    
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🧪 Force approving as user 149670080:', eventId);
      const response = await base44.functions.invoke('forceApproveAs149670080', {
        request_id: eventId,
        action: 'approve'
      });
      
      setResult({
        ok: response.data.ok !== false,
        status: 200,
        data: response.data,
        endpoint: 'forceApproveAs149670080'
      });
      
      if (response.data.ok !== false) {
        toast.success('🎉 Force approval SUCCESS!');
      } else {
        toast.error(response.data.error || 'Force approval failed');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Diagnose PCO Token function
  const testDiagnosePCOToken = async () => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🔬 Running PCO token diagnostic...');
      const response = await base44.functions.invoke('diagnosePCOToken');
      
      setResult({
        ok: response.data.ok !== false,
        status: 200,
        data: response.data,
        endpoint: 'diagnosePCOToken'
      });
      
      if (response.data.ok !== false) {
        toast.success('Diagnostic complete!');
      } else {
        toast.error('Diagnostic failed');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to run diagnostic: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Diagnose PCO Connection
  const testDiagnosePCOConnection = async () => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🔬 Running PCO connection diagnostic...');
      const response = await base44.functions.invoke('diagnosePCOConnection');
      
      setResult({
        ok: response.data.ok !== false,
        status: 200,
        data: response.data,
        endpoint: 'diagnosePCOConnection'
      });
      
      if (response.data.ok !== false) {
        toast.success('Connection diagnostic complete!');
      } else {
        toast.error('Connection diagnostic failed');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to run diagnostic: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Lookup specific PCO user by ID
  const testLookupUser = async () => {
    if (!lookupUserId) {
      toast.error('Please enter a user ID');
      return;
    }
    
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🔍 Looking up PCO user ID:', lookupUserId);
      
      // Get token
      const tokenResponse = await base44.functions.invoke('getPCOToken');
      if (!tokenResponse.data.ok) {
        throw new Error('Failed to get PCO token');
      }
      
      const token = tokenResponse.data.access_token;
      
      // Try Calendar API
      console.log('📞 Trying Calendar API: /calendar/v2/people/' + lookupUserId);
      const calendarResponse = await fetch(`https://api.planningcenteronline.com/calendar/v2/people/${lookupUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const calendarResult = {
        status: calendarResponse.status,
        ok: calendarResponse.ok,
        data: null,
        error: null
      };
      
      if (calendarResponse.ok) {
        calendarResult.data = await calendarResponse.json();
      } else {
        calendarResult.error = await calendarResponse.text();
      }
      
      // Try People API
      console.log('📞 Trying People API: /people/v2/people/' + lookupUserId);
      const peopleResponse = await fetch(`https://api.planningcenteronline.com/people/v2/people/${lookupUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const peopleResult = {
        status: peopleResponse.status,
        ok: peopleResponse.ok,
        data: null,
        error: null
      };
      
      if (peopleResponse.ok) {
        peopleResult.data = await peopleResponse.json();
      } else {
        peopleResult.error = await peopleResponse.text();
      }
      
      setResult({
        ok: true,
        status: 200,
        data: {
          user_id: lookupUserId,
          calendar_api: calendarResult,
          people_api: peopleResult
        },
        endpoint: 'lookupUser'
      });
      
      if (!calendarResult.ok && !peopleResult.ok) {
        toast.error(`User ${lookupUserId} not found in any PCO API`);
      } else {
        toast.success('User lookup complete');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to lookup user: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Deep diagnostic
  const testDeepDiagnostic = async () => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🔬 Running DEEP PCO diagnostic...');
      const response = await base44.functions.invoke('deepPCODiagnostic');
      
      setResult({
        ok: true,
        status: 200,
        data: response.data,
        endpoint: 'deepPCODiagnostic'
      });
      
      toast.success('Deep diagnostic complete!');
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Failed to run diagnostic: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Test approval with full details
  const testApprovalWithDetails = async () => {
    if (!eventId) {
      toast.error('Please enter a request ID');
      return;
    }
    
    setTestLoading(true);
    setDetailedTestResult(null);
    setResult(null); // Clear main result when detailed test is run
    try {
      console.log('🧪 Testing approval with FULL details for request:', eventId);
      const response = await base44.functions.invoke('testApprovalWithDetails', {
        request_id: eventId
      });
      
      console.log('📊 Full Test Result:', response.data);
      
      setDetailedTestResult(response.data.report);
      
      setResult({
        ok: true,
        status: 200,
        data: response.data,
        endpoint: 'testApprovalWithDetails'
      });
      
      toast.success('Test complete! Check results below.');
    } catch (error) {
      console.error('❌ Test error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Test failed: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // NEW: Investigate what 3566727 actually is
  const testInvestigate3566727 = async () => {
    setTestLoading(true);
    setResult(null);
    setDetailedTestResult(null);
    try {
      console.log('🔍 Investigating what 3566727 actually is...');
      const response = await base44.functions.invoke('investigateWhat3566727Is');
      
      setResult({
        ok: true,
        status: 200,
        data: response.data,
        endpoint: 'investigateWhat3566727Is'
      });
      
      toast.success('Investigation complete!');
    } catch (error) {
      console.error('❌ Investigation error:', error);
      setResult({
        ok: false,
        error: error.message
      });
      toast.error('Investigation failed: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Translation helper
  const translateResult = () => {
    if (!result || !result.ok || !result.data) return null;

    const data = result.data;

    // NEW: Detailed approval test results
    if (result.endpoint === 'testApprovalWithDetails' && detailedTestResult) {
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🧪 Detailed Approval Test Results</h3>
          
          {/* Test Steps */}
          {detailedTestResult.steps?.map((step, idx) => (
            <Card key={idx} className={`border-2 ${
              step.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            }`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {step.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  {step.step}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {step.user_id && (
                    <div>
                      <span className="text-slate-500">User ID:</span>
                      <span className="ml-2 font-mono font-semibold">{step.user_id}</span>
                    </div>
                  )}
                  {step.user_name && (
                    <div>
                      <span className="text-slate-500">Name:</span>
                      <span className="ml-2">{step.user_name}</span>
                    </div>
                  )}
                  {step.status && (
                    <div>
                      <span className="text-slate-500">HTTP Status:</span>
                      <Badge className={step.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {step.status}
                      </Badge>
                    </div>
                  )}
                  {step.error && (
                    <div className="mt-2 p-3 bg-white rounded border">
                      <p className="text-xs font-semibold text-red-700 mb-1">Error Details:</p>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">
                        {typeof step.error === 'string' ? step.error : JSON.stringify(step.error, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.parsed_error && (
                    <div className="mt-2 p-3 bg-white rounded border">
                      <p className="text-xs font-semibold text-red-700 mb-1">Parsed Error:</p>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap">
                        {typeof step.parsed_error === 'string' ? step.parsed_error : JSON.stringify(step.parsed_error, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.response && (
                    <div className="mt-2 p-3 bg-white rounded border">
                      <p className="text-xs font-semibold text-green-700 mb-1">Success Response:</p>
                      <pre className="text-xs text-green-600 whitespace-pre-wrap">
                        {step.response}
                      </pre>
                    </div>
                  )}
                  {step.request_data && (
                    <div className="mt-2 p-3 bg-white rounded border">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Request Data:</p>
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(step.request_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Phantom User Detection */}
          {detailedTestResult.phantom_user_detected && (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong className="text-red-900">🚨 PHANTOM USER DETECTED!</strong>
                <p className="mt-1">The token is writing as user ID: <strong>{detailedTestResult.phantom_user_detected}</strong></p>
                <p className="mt-1 text-sm">This is NOT your Calendar user ID ({detailedTestResult.correct_user_id || 'unknown'}). Your token has the wrong OAuth app association.</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Issue */}
          {detailedTestResult.permission_issue && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                <strong className="text-orange-900">🔒 Permission Issue Detected</strong>
                <p className="mt-1 text-sm">You may not be in the correct approval group for this resource.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    // Event instances
    if (result.endpoint?.includes('/event_instances')) {
      let events = data.data || [];
      const resourcesData = data._resourcesData || [];
      
      // CLIENT-SIDE DATE FILTERING (using stored clientFilterDate)
      if (clientFilterDate) {
        console.log('🔍 Client-side filtering for date:', clientFilterDate);
        
        const [year, month, day] = clientFilterDate.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        console.log('📅 Filtering between:', targetDate, 'and', nextDay);
        
        events = events.filter(event => {
          const startsAt = event.attributes?.starts_at;
          if (!startsAt) return false;
          
          const eventDate = new Date(startsAt);
          const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
          
          const matches = eventDateOnly >= targetDate && eventDateOnly < nextDay;
          
          if (matches) {
            console.log('✅ Match:', event.attributes?.name, 'starts:', startsAt);
          }
          
          return matches;
        });
        
        console.log('🎯 Filtered to', events.length, 'events on', clientFilterDate);
      }
      
      // Calculate resource counts
      let eventsWithResources = 0;
      let eventsWithBuildingAccess = 0;
      
      events.forEach(event => {
        const eventId = event.relationships?.event?.data?.id;
        const eventResources = resourcesData.find(r => r.eventId === eventId);
        const resources = eventResources?.resources || [];
        
        if (resources.length > 0) {
          eventsWithResources++;
        }
        
        const hasBuildingAccess = resources.some(r => {
          const resourceId = r.relationships?.resource?.data?.id;
          const resourceDetails = eventResources?.included?.find(i => i.type === 'Resource' && i.id === resourceId);
          return resourceDetails?.attributes?.name?.toLowerCase().includes('building access');
        });
        
        if (hasBuildingAccess) {
          eventsWithBuildingAccess++;
        }
      });
      
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-slate-900">📅 Event Instances Found: {events.length}</h3>
            {eventsWithResources > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                <Package className="w-3 h-3 mr-1" />
                {eventsWithResources} with resources
              </Badge>
            )}
            {eventsWithBuildingAccess > 0 && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                <MapPin className="w-3 h-3 mr-1" />
                {eventsWithBuildingAccess} with building access
              </Badge>
            )}
          </div>
          {clientFilterDate && (
            <p className="text-sm text-slate-600">
              Showing events on <strong>{new Date(clientFilterDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </p>
          )}
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event, idx) => {
                const eventId = event.relationships?.event?.data?.id;
                const eventResources = resourcesData.find(r => r.eventId === eventId);
                const resources = eventResources?.resources || [];
                const included = eventResources?.included || [];
                
                return <EventCard key={idx} event={event} resources={resources} included={included} eventId={eventId} />;
              })}
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-slate-700">No events found for this date.</p>
              <p className="text-sm text-slate-500 mt-1">
                Try selecting a different date or check the full JSON response below.
              </p>
            </div>
          )}
        </div>
      );
    }

    // Approval groups
    if (result.endpoint?.includes('/resource_approval_groups') && !result.endpoint.includes('/resources')) {
      const groups = data.data || [];
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">👥 Approval Groups Found: {groups.length}</h3>
          {groups.length > 0 ? (
            <div className="space-y-2">
              {groups.map((group, idx) => (
                <Card key={idx} className="bg-slate-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-900">{group.attributes?.name || 'Unnamed Group'}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Created: {group.attributes?.created_at ? new Date(group.attributes.created_at).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Group ID</p>
                        <p className="text-sm font-mono text-blue-600">{group.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No approval groups found</p>
          )}
        </div>
      );
    }

    // Resources in a group
    if (result.endpoint?.includes('/resources')) {
      const resources = data.data || [];
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">📦 Resources Found: {resources.length}</h3>
          {resources.length > 0 ? (
            <div className="space-y-2">
              {resources.map((resource, idx) => (
                <Card key={idx} className="bg-slate-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-green-600" />
                        <div>
                          <h4 className="font-semibold text-slate-900">{resource.attributes?.name || 'Unnamed Resource'}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{resource.attributes?.kind || 'Unknown Type'}</Badge>
                            {resource.attributes?.room_type && (
                              <Badge variant="outline" className="text-xs">{resource.attributes.room_type}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Resource ID</p>
                        <p className="text-sm font-mono text-blue-600">{resource.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No resources found in this group</p>
          )}
        </div>
      );
    }

    // Event resource requests
    if (result.endpoint?.includes('/event_resource_requests')) {
      const requests = data.data || [];
      const included = data.included || [];
      
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">📋 Resource Requests Found: {requests.length}</h3>
          {requests.length > 0 ? (
            <div className="space-y-2">
              {requests.map((request, idx) => {
                const resourceId = request.relationships?.resource?.data?.id;
                const resource = included.find(i => i.type === 'Resource' && i.id === resourceId);
                const approvalStatus = request.attributes?.approval_status;
                
                return (
                  <Card key={idx} className="bg-slate-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              {resource?.attributes?.name || 'Unknown Resource'}
                            </h4>
                            {approvalStatus === 'A' && (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {approvalStatus === 'P' && (
                              <Badge className="bg-yellow-100 text-yellow-700">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {approvalStatus === 'R' && (
                              <Badge className="bg-red-100 text-red-700">
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{resource?.attributes?.kind || 'Unknown Type'}</Badge>
                              {request.attributes?.quantity && (
                                <span className="text-xs text-slate-600">Quantity: {request.attributes.quantity}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <span className="text-xs font-semibold text-blue-900">Request ID:</span>
                              <code className="text-sm font-mono text-blue-700 bg-white px-2 py-1 rounded border border-blue-300 select-all">
                                {request.id}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(request.id);
                                  toast.success('Request ID copied!');
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500">No resource requests for this event</p>
          )}
        </div>
      );
    }

    // Event details
    if (result.endpoint?.includes('/events/') && !result.endpoint.includes('_requests')) {
      const event = data.data;
      const included = data.included || [];
      const tags = included.filter(i => i.type === 'Tag');
      
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">📅 Event Details</h3>
          <Card className="bg-slate-50">
            <CardContent className="p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-lg text-slate-900">{event?.attributes?.name || 'Untitled Event'}</h4>
                <p className="text-sm text-slate-600 mt-1">{event?.attributes?.summary || 'No summary'}</p>
              </div>
              
              {event?.attributes?.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                  <p className="text-sm text-slate-700 mt-1">{event.attributes.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Approval Status</p>
                  <p className="text-sm text-slate-700 mt-1">{event?.attributes?.approval_status || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Percent Approved</p>
                  <p className="text-sm text-slate-700 mt-1">{event?.attributes?.percent_approved || 0}%</p>
                </div>
              </div>
              
              {tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag.attributes?.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-xs text-slate-500">Event ID: <span className="font-mono text-blue-600">{event?.id}</span></p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Approvals tab results
    if (result.endpoint === 'getMyPendingApprovals' || result.endpoint === 'approveResourceRequest' || result.endpoint === 'denyResourceRequest' || result.endpoint === 'forceApproveAs149670080') {
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">
            {result.endpoint === 'getMyPendingApprovals' ? `My Pending Approvals: ${data.approvals?.length || 0}` : ''}
            {result.endpoint === 'approveResourceRequest' ? 'Approval Request Result' : ''}
            {result.endpoint === 'denyResourceRequest' ? 'Denial Request Result' : ''}
            {result.endpoint === 'forceApproveAs149670080' ? 'Force Approval Request Result' : ''}
          </h3>
          {data.approvals && data.approvals.length > 0 ? (
            <div className="space-y-2">
              {data.approvals.map((approval, idx) => (
                <Card key={idx} className="bg-slate-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-900">{approval.event_name || 'Unnamed Event'}</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          Resource: {approval.resource_name || 'Unknown'} (x{approval.quantity || 1})
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Starts: {approval.starts_at ? new Date(approval.starts_at).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Request ID</p>
                        <p className="text-sm font-mono text-blue-600">{approval.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            (result.endpoint === 'getMyPendingApprovals' && <p className="text-slate-500">No pending approvals found.</p>)
          )}
          {result.endpoint !== 'getMyPendingApprovals' && data.message && (
             <p className="text-slate-700">{data.message}</p>
          )}
          {result.endpoint !== 'getMyPendingApprovals' && data.error && (
             <p className="text-red-700">Error: {data.error}</p>
          )}
        </div>
      );
    }

    // NEW: Token Diagnostic Results
    if (result.endpoint === 'diagnosePCOToken') {
      const diagnostics = data.diagnostics;
      const summary = diagnostics?.summary;
      const identities = diagnostics?.all_identities;
      
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🔬 PCO Token Diagnostic Results</h3>
          
          {/* Summary Box */}
          {summary && (
            <Card className={`border-2 ${summary.ids_match ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {summary.ids_match ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <h4 className="font-semibold text-lg">
                      {summary.ids_match ? 'Configuration Correct ✅' : 'Configuration Mismatch ❌'}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-slate-500 mb-1">Calendar /me</p>
                      <p className="font-mono text-sm font-semibold">{summary.calendar_user_id || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-slate-500 mb-1">People /me</p>
                      <p className="font-mono text-sm font-semibold">{summary.people_person_id || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-red-300 col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Token Performs Writes As</p>
                      <p className="font-mono text-lg font-bold text-red-700">{summary.token_performs_writes_as || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Identities */}
          {identities && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All PCO User IDs Found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">Email:</span>
                    <p className="font-medium">{identities.email}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">Stored ID:</span>
                    <p className="font-mono">{identities.stored_id || 'Not stored'}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">Calendar User:</span>
                    <p className="font-mono">{identities.calendar_me_id || 'N/A'}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">People Person:</span>
                    <p className="font-mono">{identities.people_me_id || 'N/A'}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">OAuth User:</span>
                    <p className="font-mono">{identities.oauth_user_id || 'N/A'}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-slate-500">Email Search:</span>
                    <p className="font-mono">{identities.calendar_user_from_email || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnostic Steps */}
          {diagnostics?.steps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnostic Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
                  {diagnostics.steps.map((step, idx) => (
                    <div key={idx} className={`${step.includes('❌') ? 'text-red-600' : step.includes('✅') ? 'text-green-600' : 'text-slate-600'}`}>
                      {step}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    // NEW: Connection Diagnostic Results
    if (result.endpoint === 'diagnosePCOConnection') {
      const diag = data.diagnostics;
      const verdict = diag?.verdict;
      
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🔬 PCO Connection Diagnostic</h3>
          
          {/* OAuth Credentials Check */}
          {diag?.oauth_credentials && (
            <Card className="border-2 border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">OAuth App Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="font-semibold">PCO_CLIENT_ID:</div>
                    <div className="font-mono text-xs">{diag.oauth_credentials.PCO_CLIENT_ID}</div>
                    <div className="font-semibold">PCO_APP_ID2:</div>
                    <div className="font-mono text-xs">{diag.oauth_credentials.PCO_APP_ID2}</div>
                  </div>
                  <div className="mt-3 p-2 bg-white rounded border">
                    <p className="font-semibold mb-1">Which credentials are set:</p>
                    {Object.entries(diag.oauth_credentials.which_is_set).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        {value ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                        <span className="font-mono text-xs">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Token Test Results */}
          {verdict && (
            <Card className={`border-2 ${verdict.ids_match ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {verdict.ids_match ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  Token Test Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-white rounded border">
                      <p className="text-xs text-slate-500">Calendar /me</p>
                      <p className="font-mono font-semibold">{verdict.calendar_me_id || 'N/A'}</p>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <p className="text-xs text-slate-500">Token writes as</p>
                      <p className="font-mono font-semibold text-red-700">{verdict.token_writes_as || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <Alert className={verdict.problem.includes('3566727') ? 'border-red-300 bg-red-50' : 'bg-blue-50 border-blue-200'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Problem:</strong> {verdict.problem}
                    </AlertDescription>
                  </Alert>

                  {diag.token_introspection && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <p className="text-sm font-semibold mb-2">Token Introspection:</p>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(diag.token_introspection, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnostic Steps Log */}
          {diag?.steps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnostic Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
                  {diag.steps.map((step, idx) => (
                    <div key={idx} className={`${step.includes('❌') ? 'text-red-600' : step.includes('✅') ? 'text-green-600' : 'text-slate-600'}`}>
                      {step}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    // NEW: User Lookup Results
    if (result.endpoint === 'lookupUser') {
      const userId = data.user_id;
      const calendar = data.calendar_api;
      const people = data.people_api;
      
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🔍 User ID Lookup: {userId}</h3>
          
          {/* Calendar API Result */}
          <Card className={`border-2 ${calendar.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {calendar.ok ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                Calendar API (/calendar/v2/people/{userId})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={calendar.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    HTTP {calendar.status}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {calendar.ok ? '✅ User EXISTS in Calendar' : '❌ User NOT FOUND in Calendar'}
                  </span>
                </div>
                
                {calendar.ok && calendar.data?.data && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm font-semibold text-slate-700 mb-2">User Details:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Name:</span>
                        <p className="font-medium">{calendar.data.data.attributes?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>
                        <p className="font-medium">{calendar.data.data.attributes?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Status:</span>
                        <p className="font-medium">{calendar.data.data.attributes?.status || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Permissions:</span>
                        <p className="font-medium">{calendar.data.data.attributes?.permissions || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!calendar.ok && (
                  <div className="mt-2 p-2 bg-white rounded border text-xs font-mono text-red-600">
                    {calendar.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* People API Result */}
          <Card className={`border-2 ${people.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {people.ok ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                People API (/people/v2/people/{userId})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={people.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    HTTP {people.status}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {people.ok ? '✅ Person EXISTS in People' : '❌ Person NOT FOUND in People'}
                  </span>
                </div>
                
                {people.ok && people.data?.data && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Person Details:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Name:</span>
                        <p className="font-medium">{people.data.data.attributes?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Status:</span>
                        <p className="font-medium">{people.data.data.attributes?.status || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Child:</span>
                        <p className="font-medium">{people.data.data.attributes?.child ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Created:</span>
                        <p className="font-medium">
                          {people.data.data.attributes?.created_at 
                            ? new Date(people.data.data.attributes.created_at).toLocaleDateString() 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!people.ok && (
                  <div className="mt-2 p-2 bg-white rounded border text-xs font-mono text-red-600">
                    {people.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Alert className={!calendar.ok && !people.ok ? 'border-red-300 bg-red-50' : 'bg-blue-50 border-blue-200'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Verdict:</strong>
              {!calendar.ok && !people.ok && (
                <span className="text-red-700"> User ID {userId} does NOT exist in PCO Calendar or People databases. This is likely an orphaned ID or belongs to a deleted/archived account.</span>
              )}
              {calendar.ok && !people.ok && (
                <span className="text-blue-700"> User exists in Calendar but not in People (unusual setup).</span>
              )}
              {!calendar.ok && people.ok && (
                <span className="text-blue-700"> Person exists in People but not in Calendar (they may not have Calendar access).</span>
              )}
              {calendar.ok && people.ok && (
                <span className="text-green-700"> User exists in both Calendar and People databases.</span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // NEW: Deep diagnostic results
    if (result.endpoint === 'deepPCODiagnostic') {
      const report = data.report;
      const verdict = report?.verdict;
      
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🔬 Deep PCO Diagnostic Report</h3>
          
          {/* User Info */}
          {report?.user && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-sm"><strong>User:</strong> {report.user.email}</p>
                <p className="text-sm"><strong>ID:</strong> {report.user.id}</p>
              </CardContent>
            </Card>
          )}

          {/* Token Info */}
          {report?.token_info && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Token Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500">Token (last 10):</span>
                    <p className="font-mono">{report.token_info.last_10_chars}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Stored PCO User ID:</span>
                    <p className="font-mono">{report.token_info.stored_pco_user_id || 'null'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Expires:</span>
                    <p>{report.token_info.expires_at ? new Date(report.token_info.expires_at).toLocaleString() : 'unknown'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Length:</span>
                    <p>{report.token_info.token_length} chars</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Environment */}
          {report?.environment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Environment Credentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm font-mono">
                <div className="flex justify-between">
                  <span>PCO_CLIENT_ID:</span>
                  <span>{report.environment.PCO_CLIENT_ID}</span>
                </div>
                <div className="flex justify-between">
                  <span>PCO_CLIENT_SECRET:</span>
                  <span>{report.environment.PCO_CLIENT_SECRET}</span>
                </div>
                <div className="flex justify-between">
                  <span>PCO_APP_ID2:</span>
                  <span className={report.environment.PCO_APP_ID2 !== 'NOT SET' ? 'text-orange-600' : ''}>
                    {report.environment.PCO_APP_ID2}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PCO_SECRET2:</span>
                  <span className={report.environment.PCO_SECRET2 !== 'NOT SET' ? 'text-orange-600' : ''}>
                    {report.environment.PCO_SECRET2}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verdict */}
          {verdict && (
            <Card className={`border-2 ${verdict.problem_identified ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {verdict.problem_identified ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {verdict.problem_identified ? 'Problem Identified' : 'Configuration OK'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {verdict.problem && (
                  <Alert className="border-red-300 bg-red-100">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{verdict.problem}</strong>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-white rounded">
                    <span className="text-slate-500">From New App:</span>
                    <p className={verdict.token_is_from_new_app ? 'text-green-600 font-semibold' : 'text-red-600'}>
                      {verdict.token_is_from_new_app ? '✅ YES' : '❌ NO'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded">
                    <span className="text-slate-500">From Old App:</span>
                    <p className={verdict.token_is_from_old_app ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {verdict.token_is_from_old_app ? '⚠️ YES' : '✅ NO'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded">
                    <span className="text-slate-500">Writes as User:</span>
                    <p className="font-mono font-semibold">{verdict.writes_as_user || 'unknown'}</p>
                  </div>
                  <div className="p-2 bg-white rounded">
                    <span className="text-slate-500">Calendar User:</span>
                    <p className="font-mono">{verdict.calendar_user_id || 'unknown'}</p>
                  </div>
                </div>

                {verdict.solution && verdict.solution.length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded border-l-4 border-orange-500">
                    <p className="font-semibold text-sm mb-2">🔧 Solution Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {verdict.solution.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Diagnostic Log */}
          {report?.steps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnostic Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 font-mono text-xs max-h-96 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded">
                  {report.steps.map((step, idx) => (
                    <div key={idx} className={`${
                      step.includes('❌') ? 'text-red-400' : 
                      step.includes('✅') ? 'text-green-400' : 
                      step.includes('⚠️') ? 'text-yellow-400' :
                      step.includes('🔧') ? 'text-orange-400' :
                      'text-slate-300'
                    }`}>
                      {step}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    // NEW: Investigation results
    if (result.endpoint === 'investigateWhat3566727Is') {
      const report = data.report;
      
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">🔍 What IS 3566727?</h3>
          
          {/* Conclusion */}
          {report.conclusion && (
            <Card className="border-2 border-purple-300 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                  Conclusion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2"><strong>Likely Cause:</strong> {report.conclusion.likely_cause}</p>
                <p className="text-sm"><strong>Action Needed:</strong> {report.conclusion.action_needed}</p>
              </CardContent>
            </Card>
          )}

          {/* All Investigations */}
          {report.investigations?.map((inv, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base">{inv.test}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {inv.result && (
                    <div>
                      <span className="text-slate-500">Result:</span>
                      <Badge className={
                        inv.result === 'FOUND' ? 'bg-green-100 text-green-700 ml-2' :
                        inv.result === 'NOT FOUND' ? 'bg-red-100 text-red-700 ml-2' :
                        'bg-slate-100 text-slate-700 ml-2'
                      }>
                        {typeof inv.result === 'string' ? inv.result : 'See below'}
                      </Badge>
                    </div>
                  )}
                  
                  {inv.conclusion && (
                    <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                      <strong>💡 {inv.conclusion}</strong>
                    </div>
                  )}

                  {inv.PCO_CLIENT_ID && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500">PCO_CLIENT_ID:</span>
                        <p className="font-mono text-xs">{inv.PCO_CLIENT_ID}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">PCO_APP_ID2:</span>
                        <p className="font-mono text-xs">{inv.PCO_APP_ID2 || 'NOT SET'}</p>
                      </div>
                      {inv.matches_mystery_id !== undefined && (
                        <div className="col-span-2">
                          <Badge className={inv.matches_mystery_id ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                            {inv.matches_mystery_id ? '⚠️ One matches 3566727!' : '✅ Neither matches 3566727'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {inv.application_id && (
                    <div className="p-2 bg-blue-50 rounded border border-blue-200">
                      <span className="text-slate-500">Token's Application ID:</span>
                      <p className="font-mono font-semibold">{inv.application_id}</p>
                      {inv.application_id === '3566727' && (
                        <Badge className="bg-red-100 text-red-700 mt-1">🚨 This is 3566727!</Badge>
                      )}
                    </div>
                  )}

                  {inv.resource_owner_id && (
                    <div>
                      <span className="text-slate-500">Resource Owner ID:</span>
                      <span className="ml-2 font-mono">{inv.resource_owner_id}</span>
                    </div>
                  )}

                  {inv.stored_id !== undefined && (
                    <div>
                      <span className="text-slate-500">Stored in Database:</span>
                      <span className="ml-2 font-mono">{inv.stored_id || 'null'}</span>
                      {inv.matches_3566727 && (
                        <Badge className="bg-red-100 text-red-700 ml-2">Matches 3566727!</Badge>
                      )}
                    </div>
                  )}

                  {inv.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-blue-600">View Raw Data</summary>
                      <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto max-h-48">
                        {JSON.stringify(inv.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return null;
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="groups">Approval Groups</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
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
                    Default: Next Sunday. Will fetch all future event instances and filter client-side.
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

          {/* NEW: Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Test Approval Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 {/* NEW: INVESTIGATE 3566727 - AT THE VERY TOP */}
                <div className="border-4 border-purple-300 bg-purple-50 rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-purple-900">
                    <AlertCircle className="w-6 h-6 text-purple-600" />
                    <strong className="text-lg">🔍 WHAT IS 3566727? - Run This Investigation</strong>
                  </Label>
                  <p className="text-sm text-purple-800">
                    This will investigate whether 3566727 is:<br/>
                    • An OAuth application ID<br/>
                    • A user ID<br/>
                    • Something else in PCO's system<br/>
                    <strong>This will finally tell us what the mystery ID actually is!</strong>
                  </p>
                  <Button 
                    onClick={testInvestigate3566727} 
                    disabled={testLoading} 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base font-semibold mt-3"
                  >
                    {testLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                    Investigate What 3566727 Actually Is
                  </Button>
                </div>

                {/* NEW: Detailed Approval Test - AT THE VERY TOP */}
                <div className="border-4 border-blue-300 bg-blue-50 rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-blue-900">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                    <strong className="text-lg">🔍 DETAILED APPROVAL TEST - Shows EXACT Error Message</strong>
                  </Label>
                  <p className="text-sm text-blue-800">
                    This will attempt the approval and show you the EXACT error message from PCO,
                    including which user ID it's trying to use for the write operation.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Request ID (e.g., 31445396)"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={testApprovalWithDetails} 
                      disabled={testLoading} 
                      className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 text-base font-semibold"
                    >
                      {testLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                      Test Approval (Detailed)
                    </Button>
                  </div>
                  <Alert className="bg-blue-100 border-blue-300 mt-3">
                    <AlertDescription className="text-sm">
                      <strong>What this does:</strong> Attempts the actual approval and captures the complete
                      error message from PCO, including any references to user IDs.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* NEW: 🧪 FORCE APPROVE TEST - AT THE VERY TOP */}
                <div className="border-4 border-purple-300 bg-purple-50 rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-purple-900">
                    <AlertCircle className="w-6 h-6 text-purple-600" />
                    <strong className="text-lg">🧪 FORCE APPROVE TEST - Use User ID 149670080</strong>
                  </Label>
                  <p className="text-sm text-purple-800">
                    This will FORCE the approval to use user ID 149670080 (your actual Calendar user ID).
                    If this works but normal approval doesn't, we know the issue is PCO defaulting to wrong user.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Request ID"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={testForceApproveAs149670080} 
                      disabled={testLoading} 
                      className="bg-purple-600 hover:bg-purple-700 text-white h-12 px-6 text-base font-semibold"
                    >
                      {testLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                      Force Approve as 149670080
                    </Button>
                  </div>
                  <Alert className="bg-purple-100 border-purple-300 mt-3">
                    <AlertDescription className="text-sm">
                      <strong>What this tests:</strong> If this succeeds, it proves PCO is accepting approvals from 149670080, 
                      but your normal token is somehow defaulting to 3566727 for write operations.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Deep Diagnostic - AT THE VERY TOP */}
                <div className="border-4 border-red-300 bg-red-50 rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-red-900">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <strong className="text-lg">🔥 DEEP DIAGNOSTIC - RUN THIS FIRST!</strong>
                  </Label>
                  <p className="text-sm text-red-800">
                    This will show EXACTLY which OAuth app issued your token, which user it writes as,
                    and give you step-by-step instructions to fix the problem.
                  </p>
                  <Button 
                    onClick={testDeepDiagnostic} 
                    disabled={testLoading} 
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-semibold"
                  >
                    {testLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                    Run Deep Diagnostic
                  </Button>
                </div>

                {/* Connection Diagnostic Section */}
                <div className="border-2 border-orange-300 bg-orange-50 rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-orange-900">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <strong>🔥 Diagnose Connection Issue</strong>
                  </Label>
                  <p className="text-sm text-orange-800">
                    This will show EXACTLY which OAuth app your token is from and which user ID it writes as.
                  </p>
                  <Button 
                    onClick={testDiagnosePCOConnection} 
                    disabled={testLoading} 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                    Run Connection Diagnostic
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Get My Pending Approvals</Label>
                  <Button onClick={testGetMyApprovals} disabled={testLoading} className="w-full">
                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Fetch My Approvals
                  </Button>
                  <p className="text-xs text-slate-500">
                    Gets all pending approvals assigned to you from the database
                  </p>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label>Approve Request</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Request ID"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                    />
                    <Button onClick={testApproveRequest} disabled={testLoading} className="bg-green-600 hover:bg-green-700">
                      {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Approve a specific resource request (you must be in the approval group)
                  </p>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label>Deny Request</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Request ID"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                    />
                    <Button onClick={testDenyRequest} disabled={testLoading} variant="destructive">
                      {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Deny a specific resource request (you must be in the approval group)
                  </p>
                </div>

                {/* Token Diagnostic Section */}
                <div className="border-t pt-4 space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-600" />
                    Diagnose PCO Token
                  </Label>
                  <Button 
                    onClick={testDiagnosePCOToken} 
                    disabled={testLoading} 
                    variant="outline"
                    className="w-full border-purple-300 hover:bg-purple-50"
                  >
                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                    Run Token Diagnostic
                  </Button>
                  <Alert className="bg-purple-50 border-purple-200">
                    <AlertDescription className="text-sm">
                      <strong>What this does:</strong> Checks all PCO user IDs, identifies which ID the OAuth token belongs to, and shows if there's a mismatch causing the "User with id 3566727" error.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* User ID Lookup Section */}
                <div className="border-t pt-4 space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Lookup PCO User by ID
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter PCO User ID (e.g., 3566727)"
                      value={lookupUserId}
                      onChange={(e) => setLookupUserId(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={testLookupUser} 
                      disabled={testLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
                    </Button>
                  </div>
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-sm">
                      <strong>Prove it:</strong> Enter user ID 3566727 and click Lookup to check if this user actually exists in PCO Calendar and People databases. Pre-filled with the mystery ID from your errors.
                    </AlertDescription>
                  </Alert>
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
            <CardContent className="space-y-6">
              {result.url && (
                <div className="p-3 bg-slate-100 rounded-lg">
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
                <>
                  {/* Translated Summary */}
                  {translateResult() && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        What This Means
                      </h3>
                      {translateResult()}
                    </div>
                  )}

                  {/* Summary Stats */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Found {result.data?.data?.length || result.data?.approvals?.length || 0} items
                    </p>
                    {result.data?.meta && (
                      <p className="text-xs text-blue-700">
                        Total: {result.data.meta.total_count || 'N/A'}
                      </p>
                    )}
                  </div>
                  
                  {/* Raw JSON */}
                  <details className="border rounded-lg bg-slate-50">
                    <summary className="p-4 cursor-pointer font-semibold text-slate-700 hover:bg-slate-100">
                      View Raw JSON Response
                    </summary>
                    <div className="p-4 border-t max-h-[600px] overflow-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  </details>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// NEW: Collapsible Event Card Component
function EventCard({ event, resources, included, eventId }) {
  const [showRooms, setShowRooms] = useState(false);
  const [showResources, setShowResources] = useState(false);
  
  // Split resources into rooms and other resources
  const rooms = resources.filter(r => {
    const resourceId = r.relationships?.resource?.data?.id;
    const resourceDetails = included.find(i => i.type === 'Resource' && i.id === resourceId);
    return resourceDetails?.attributes?.kind === 'Room';
  });
  
  const otherResources = resources.filter(r => {
    const resourceId = r.relationships?.resource?.data?.id;
    const resourceDetails = included.find(i => i.type === 'Resource' && i.id === resourceId);
    return resourceDetails?.attributes?.kind !== 'Room';
  });
  
  return (
    <Card className="bg-slate-50">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Event Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900">{event.attributes?.name || 'Untitled Event'}</h4>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {event.attributes?.starts_at ? new Date(event.attributes.starts_at).toLocaleString() : 'No start time'}
                    {event.attributes?.ends_at && ` - ${new Date(event.attributes.ends_at).toLocaleTimeString()}`}
                  </span>
                </div>
                {event.attributes?.all_day_event && (
                  <Badge variant="outline" className="text-xs">All Day Event</Badge>
                )}
                {event.attributes?.recurrence && event.attributes.recurrence !== 'None' && (
                  <Badge variant="outline" className="text-xs">{event.attributes.recurrence}</Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Event ID</p>
              <p className="text-sm font-mono text-blue-600">{eventId}</p>
            </div>
          </div>

          {/* Rooms Section */}
          {rooms.length > 0 && (
            <>
              <div className="border-t border-slate-200 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRooms(!showRooms)}
                  className="w-full justify-between hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-medium">
                      Rooms ({rooms.length})
                    </span>
                  </span>
                  {showRooms ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {showRooms && (
                <div className="bg-white rounded-lg p-3 border border-slate-200 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {rooms.map((resource, ridx) => {
                      const resourceId = resource.relationships?.resource?.data?.id;
                      const resourceDetails = included.find(i => i.type === 'Resource' && i.id === resourceId);
                      const approvalStatus = resource.attributes?.approval_status;
                      
                      return (
                        <div key={ridx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                          <div className="flex items-center gap-2 flex-1">
                            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {resourceDetails?.attributes?.name || 'Unknown Room'}
                              </p>
                              {resourceDetails?.attributes?.room_type && (
                                <p className="text-xs text-slate-500">
                                  {resourceDetails.attributes.room_type}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {resource.attributes?.quantity && (
                              <span className="text-xs text-slate-500">
                                qty: {resource.attributes.quantity}
                              </span>
                            )}
                            {approvalStatus === 'A' && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {approvalStatus === 'P' && (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {approvalStatus === 'R' && (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Other Resources Section */}
          {otherResources.length > 0 && (
            <>
              <div className="border-t border-slate-200 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResources(!showResources)}
                  className="w-full justify-between hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">
                      Resources ({otherResources.length})
                    </span>
                  </span>
                  {showResources ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {showResources && (
                <div className="bg-white rounded-lg p-3 border border-slate-200 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {otherResources.map((resource, ridx) => {
                      const resourceId = resource.relationships?.resource?.data?.id;
                      const resourceDetails = included.find(i => i.type === 'Resource' && i.id === resourceId);
                      const approvalStatus = resource.attributes?.approval_status;
                      
                      return (
                        <div key={ridx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                          <div className="flex items-center gap-2 flex-1">
                            <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {resourceDetails?.attributes?.name || 'Unknown Resource'}
                              </p>
                              {resourceDetails?.attributes?.kind && (
                                <p className="text-xs text-slate-500">
                                  {resourceDetails.attributes.kind}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {resource.attributes?.quantity && (
                              <span className="text-xs text-slate-500">
                                qty: {resource.attributes.quantity}
                              </span>
                            )}
                            {approvalStatus === 'A' && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {approvalStatus === 'P' && (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {approvalStatus === 'R' && (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
