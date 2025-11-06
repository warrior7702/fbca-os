
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
  
  // NEW: Store the filter date separately (not sent to PCO)
  const [clientFilterDate, setClientFilterDate] = useState(null);

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

  // Translation helper
  const translateResult = () => {
    if (!result || !result.ok || !result.data) return null;

    const data = result.data;

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
    if (result.endpoint === 'getMyPendingApprovals' || result.endpoint === 'approveResourceRequest' || result.endpoint === 'denyResourceRequest') {
      return (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">
            {result.endpoint === 'getMyPendingApprovals' ? `My Pending Approvals: ${data.approvals?.length || 0}` : ''}
            {result.endpoint === 'approveResourceRequest' ? 'Approval Request Result' : ''}
            {result.endpoint === 'denyResourceRequest' ? 'Denial Request Result' : ''}
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
