import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Bug,
  Calendar,
  Mail,
  User
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DiagnoseMysteryResource() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setDiagnosticData(null);

    try {
      console.log('🔍 Starting diagnostic...');

      const token = user.pco_access_token;

      // Step 1: Fetch all upcoming events
      const eventsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!eventsResponse.ok) {
        throw new Error(`PCO API error: ${eventsResponse.status}`);
      }

      const eventsData = await eventsResponse.json();
      const eventInstances = eventsData.data || [];

      // Get unique event IDs
      const eventIds = [...new Set(eventInstances.map(instance => 
        instance.relationships?.event?.data?.id
      ).filter(Boolean))];

      console.log(`📅 Found ${eventIds.length} unique events`);

      // Step 2: Check each event for Mystery Resource
      const eventsWithMysteryResource = [];

      for (const eventId of eventIds) {
        try {
          // Fetch event details
          const eventResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!eventResponse.ok) continue;

          const eventData = await eventResponse.json();
          const eventDetails = eventData.data?.attributes;
          const eventName = eventDetails?.name || 'Unknown';

          // Skip if not our target event
          if (!eventName.toLowerCase().includes('testing email')) continue;

          console.log('🎯 Found target event:', eventName);

          // Fetch resource requests for this event
          const resourcesResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!resourcesResponse.ok) continue;

          const resourcesData = await resourcesResponse.json();
          const requests = resourcesData.data || [];
          const included = resourcesData.included || [];

          // Check for Mystery Resource
          const mysteryResourceRequest = requests.find(request => {
            const resourceId = request.relationships?.resource?.data?.id;
            const resourceDetails = included.find(r => r.type === 'Resource' && r.id === resourceId);
            const resourceName = resourceDetails?.attributes?.name || '';
            return resourceName.toLowerCase().includes('mystery resource');
          });

          // Get owner details
          const ownerId = eventData.data?.relationships?.owner?.data?.id;
          const ownerName = eventData.data?.attributes?.owner_name;
          let ownerEmail = null;

          if (ownerId) {
            // Try Calendar API
            const ownerResponse = await fetch(
              `https://api.planningcenteronline.com/calendar/v2/people/${ownerId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (ownerResponse.ok) {
              const ownerData = await ownerResponse.json();
              ownerEmail = ownerData.data?.attributes?.email;
            }

            // If no email, try People API
            if (!ownerEmail) {
              const peopleResponse = await fetch(
                `https://api.planningcenteronline.com/people/v2/people/${ownerId}?include=emails`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (peopleResponse.ok) {
                const peopleData = await peopleResponse.json();
                if (peopleData.included && peopleData.included.length > 0) {
                  const primaryEmail = peopleData.included.find(item => 
                    item.type === 'Email' && item.attributes?.primary
                  );
                  ownerEmail = primaryEmail?.attributes?.address || peopleData.included[0]?.attributes?.address;
                }
              }
            }
          }

          // Get event instance for date
          const eventInstance = eventInstances.find(inst => 
            inst.relationships?.event?.data?.id === eventId
          );

          eventsWithMysteryResource.push({
            event_id: eventId,
            event_name: eventName,
            event_start: eventInstance?.attributes?.starts_at,
            has_mystery_resource: !!mysteryResourceRequest,
            mystery_resource_status: mysteryResourceRequest?.attributes?.approval_status,
            mystery_resource_id: mysteryResourceRequest?.id,
            owner_name: ownerName,
            owner_email: ownerEmail,
            owner_id: ownerId,
            all_resources: requests.map(r => {
              const resourceId = r.relationships?.resource?.data?.id;
              const resourceDetails = included.find(res => res.type === 'Resource' && res.id === resourceId);
              return {
                name: resourceDetails?.attributes?.name,
                status: r.attributes?.approval_status,
                id: r.id
              };
            })
          });

        } catch (eventError) {
          console.error('Error processing event:', eventError);
        }
      }

      // Step 3: Check existing workflow requests
      const existingRequests = await base44.entities.WorkflowRequest.filter({
        type: 'mystery_resource'
      }, '-created_date', 20);

      setDiagnosticData({
        total_events_checked: eventIds.length,
        target_events_found: eventsWithMysteryResource,
        existing_workflow_requests: existingRequests
      });

      toast.success('Diagnostic complete!');

    } catch (error) {
      console.error('Diagnostic error:', error);
      setError(error.message);
      toast.error('Diagnostic failed');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      toast.info('Triggering Mystery Resource sync...');
      const response = await base44.functions.invoke('monitorMysteryResource');
      
      console.log('Sync result:', response.data);
      
      toast.success(`Sync complete! Created ${response.data.new_requests_created} new requests`);
      
      // Re-run diagnostic
      await runDiagnostic();
      
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-red-50 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <Bug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Mystery Resource Diagnostic</h1>
              <p className="text-slate-600">Debug why events aren't triggering workflows</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={runDiagnostic}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Run Diagnostic
                </>
              )}
            </Button>
            
            <Button
              onClick={triggerSync}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Trigger Sync Now
            </Button>
          </div>
        </div>

        {/* User Info */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Logged in as: {user.email}</span>
              {user.pco_access_token ? (
                <Badge className="bg-green-500 text-white">PCO Connected</Badge>
              ) : (
                <Badge className="bg-red-500 text-white">PCO Not Connected</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnostic Results */}
        {diagnosticData && (
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Scan Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">
                      {diagnosticData.total_events_checked}
                    </p>
                    <p className="text-sm text-slate-600">Events Checked</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {diagnosticData.target_events_found.length}
                    </p>
                    <p className="text-sm text-slate-600">Target Events Found</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">
                      {diagnosticData.existing_workflow_requests.length}
                    </p>
                    <p className="text-sm text-slate-600">Existing Workflows</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Events */}
            {diagnosticData.target_events_found.length > 0 && (
              <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    Target Events Found ({diagnosticData.target_events_found.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {diagnosticData.target_events_found.map((event, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-lg border border-slate-200">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">{event.event_name}</h3>
                            <p className="text-sm text-slate-600">Event ID: {event.event_id}</p>
                            {event.event_start && (
                              <p className="text-sm text-slate-600">
                                Date: {format(new Date(event.event_start), 'PPpp')}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {event.has_mystery_resource ? (
                              <Badge className="bg-green-500 text-white">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Has Mystery Resource
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500 text-white">
                                <XCircle className="w-3 h-3 mr-1" />
                                No Mystery Resource
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Owner Info */}
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Event Owner</p>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-600" />
                            <span className="text-sm font-medium">{event.owner_name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className="w-4 h-4 text-slate-600" />
                            {event.owner_email ? (
                              <span className="text-sm text-green-600">{event.owner_email}</span>
                            ) : (
                              <span className="text-sm text-red-600">No email found</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Owner ID: {event.owner_id}</p>
                        </div>

                        {/* Mystery Resource Details */}
                        {event.has_mystery_resource && (
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700 mb-1 font-semibold">Mystery Resource Details</p>
                            <p className="text-sm">
                              <strong>Status:</strong>{' '}
                              {event.mystery_resource_status === 'P' ? (
                                <Badge className="bg-yellow-500 text-white">Pending</Badge>
                              ) : event.mystery_resource_status === 'A' ? (
                                <Badge className="bg-green-500 text-white">Approved</Badge>
                              ) : (
                                <Badge variant="outline">{event.mystery_resource_status || 'Unknown'}</Badge>
                              )}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Request ID: {event.mystery_resource_id}
                            </p>
                          </div>
                        )}

                        {/* All Resources */}
                        {event.all_resources.length > 0 && (
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-2 font-semibold">
                              All Resources ({event.all_resources.length})
                            </p>
                            <div className="space-y-1">
                              {event.all_resources.map((resource, ridx) => (
                                <div key={ridx} className="text-xs flex items-center justify-between">
                                  <span className="text-slate-700">{resource.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {resource.status === 'P' ? 'Pending' :
                                     resource.status === 'A' ? 'Approved' :
                                     resource.status || 'Unknown'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Diagnostic Result */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-2">🔍 Why It's Not Triggering:</p>
                          {!event.has_mystery_resource && (
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                              <p className="text-sm text-red-700">No "Mystery Resource" found on this event</p>
                            </div>
                          )}
                          {event.has_mystery_resource && event.mystery_resource_status !== 'P' && (
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                              <p className="text-sm text-orange-700">
                                Mystery Resource status is "{event.mystery_resource_status}" (not Pending)
                              </p>
                            </div>
                          )}
                          {!event.owner_email && (
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                              <p className="text-sm text-orange-700">
                                Owner email not found in PCO (email won't be sent but request can still be created)
                              </p>
                            </div>
                          )}
                          {event.has_mystery_resource && 
                           event.mystery_resource_status === 'P' && 
                           event.owner_email && (
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                              <p className="text-sm text-green-700">
                                ✅ Should trigger! Click "Trigger Sync Now" to create workflow request
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No Events Found */}
            {diagnosticData.target_events_found.length === 0 && (
              <Card className="border-2 border-red-200 bg-red-50">
                <CardContent className="p-8 text-center">
                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    No "Testing Email" events found
                  </h3>
                  <p className="text-sm text-red-700">
                    The scan didn't find any events with "Testing Email" in the name. 
                    Make sure the event exists in PCO Calendar and is set to a future date.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Existing Workflows */}
            {diagnosticData.existing_workflow_requests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Workflow Requests (Last 20)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {diagnosticData.existing_workflow_requests.map((req, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{req.title}</p>
                          <p className="text-xs text-slate-500">
                            {req.request_number} • PCO Request ID: {req.pco_resource_request_id || 'N/A'}
                          </p>
                        </div>
                        <Badge variant="outline">{req.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Instructions */}
        {!diagnosticData && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-3">How to use this tool:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Click "Run Diagnostic" to scan all PCO events</li>
                <li>It will find any event with "Testing Email" in the name</li>
                <li>Check if it has Mystery Resource attached</li>
                <li>See why it's not triggering (if applicable)</li>
                <li>Click "Trigger Sync Now" to manually create the workflow</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}