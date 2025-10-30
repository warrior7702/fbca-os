
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bug,
  User,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Box,
  DoorOpen,
  AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";

export default function PCODebug() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setDebugData(null);

    try {
      console.log('🔍 Starting PCO diagnostics...');

      // Get PCO token (now includes token_user_id)
      const tokenResponse = await base44.functions.invoke('getPCOToken');
      const token = tokenResponse.data.access_token;
      const tokenUserId = tokenResponse.data.token_user_id;

      console.log('🆔 Token belongs to PCO user:', tokenUserId);

      const data = {
        token_valid: !!token,
        token_expires_at: tokenResponse.data.expires_at,
        connected_as_user_id: tokenUserId, // Use the ID from the token check
        my_person: null,
        connected_as_email: null,
        approval_groups: [],
        my_groups: [],
        resources: [],
        pending_requests: [],
        my_pending_requests: []
      };

      // Get my PCO person ID
      const meResponse = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (meResponse.ok) {
        const meData = await meResponse.json();
        data.my_person = {
          id: meData.data?.id,
          name: meData.data?.attributes?.name,
          email: meData.data?.attributes?.email
        };
        data.connected_as_email = meData.data?.attributes?.email;
        console.log('✅ My PCO person:', data.my_person);
        console.log('📧 Connected as:', data.connected_as_email);
        console.log('👤 Connected as PCO User ID:', data.connected_as_user_id);
      }

      // Get all approval groups
      const groupsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        console.log('✅ Found', groupsData.data?.length, 'approval groups');

        // Check each group for membership and resources
        for (const group of groupsData.data || []) {
          const groupInfo = {
            id: group.id,
            name: group.attributes?.name,
            is_member: false,
            members: [],
            resources: []
          };

          // Get group members
          const membersResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            groupInfo.members = membersData.data?.map(m => ({
              id: m.id,
              name: m.attributes?.name
            })) || [];
            groupInfo.is_member = membersData.data?.some(m => m.id === data.my_person?.id);
          }

          // Get group resources
          const resourcesResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/resources?per_page=100`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (resourcesResponse.ok) {
            const resourcesData = await resourcesResponse.json();
            groupInfo.resources = resourcesData.data?.map(r => ({
              id: r.id,
              name: r.attributes?.name,
              kind: r.attributes?.kind
            })) || [];
          }

          data.approval_groups.push(groupInfo);

          if (groupInfo.is_member) {
            data.my_groups.push(groupInfo);
          }
        }

        console.log('✅ I am in', data.my_groups.length, 'groups');
      }

      // Build resource to group map
      const resourceToGroupMap = {};
      for (const group of data.my_groups) {
        for (const resource of group.resources) {
          resourceToGroupMap[resource.id] = group.name;
        }
      }

      // Get all pending requests
      const requestsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=100&include=event,resource',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        console.log('✅ Found', requestsData.data?.length, 'pending requests');

        // Build maps
        const eventMap = {};
        const resourceMap = {};

        if (requestsData.included) {
          requestsData.included.forEach(item => {
            if (item.type === 'Event') {
              eventMap[item.id] = item;
            } else if (item.type === 'Resource') {
              resourceMap[item.id] = item;
            }
          });
        }

        // Process all requests with future filtering
        for (const request of requestsData.data || []) {
          const resourceId = request.relationships?.resource?.data?.id;
          const eventId = request.relationships?.event?.data?.id;
          const event = eventMap[eventId];
          const resource = resourceMap[resourceId];

          // Check if event has future instances
          let hasFutureInstance = false;
          let eventStartsAt = null;
          
          try {
            const instancesResponse = await fetch(
              `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_instances?filter=future&per_page=1&order=starts_at`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (instancesResponse.ok) {
              const instancesData = await instancesResponse.json();
              if (instancesData.data && instancesData.data.length > 0) {
                hasFutureInstance = true;
                eventStartsAt = instancesData.data[0].attributes?.starts_at;
              }
            }
          } catch (err) {
            console.error('Error checking event instance:', err);
          }

          // Skip if no future instance
          if (!hasFutureInstance) {
            console.log('⏭️ Skipping past event:', event?.attributes?.name);
            continue;
          }

          const requestInfo = {
            id: request.id,
            event_name: event?.attributes?.name || 'Unknown',
            event_starts_at: eventStartsAt,
            resource_id: resourceId,
            resource_name: resource?.attributes?.name || 'Unknown',
            status: request.attributes?.approval_status,
            created_at: request.attributes?.created_at
          };

          data.pending_requests.push(requestInfo);

          // Check if this is in my groups
          const isMyGroup = resourceToGroupMap[resourceId];
          if (isMyGroup) {
            data.my_pending_requests.push(requestInfo);
          }
        }

        console.log('✅ Found', data.my_pending_requests.length, 'future requests in my groups');
      }

      // Get all resources
      const allResourcesResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/resources?per_page=100',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (allResourcesResponse.ok) {
        const allResourcesData = await allResourcesResponse.json();
        data.resources = allResourcesData.data?.map(r => ({
          id: r.id,
          name: r.attributes?.name,
          kind: r.attributes?.kind,
          quantity: r.attributes?.quantity
        })) || [];
        console.log('✅ Found', data.resources.length, 'total resources');
      }

      setDebugData(data);
      console.log('🎯 Final debug data:', data);

    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-lg">
              <Bug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">PCO Diagnostics</h1>
              <p className="text-slate-600">Debug Planning Center integration</p>
            </div>
          </div>

          <Button
            onClick={runDiagnostics}
            disabled={loading || !user?.pco_access_token}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>

        {!user?.pco_access_token && (
          <Alert className="mb-6 border-yellow-300 bg-yellow-50">
            <AlertDescription className="text-slate-700">
              Planning Center not connected. Connect in Settings first.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugData && (
          <div className="space-y-6">
            {/* User Profile with Token User ID */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Your Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Base44 Email</p>
                      <p className="font-medium">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">PCO Account Email</p>
                      <p className="font-medium">{debugData.connected_as_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">PCO Name</p>
                      <p className="font-medium">{debugData.my_person?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">PCO User ID (from OAuth token)</p>
                      <p className="font-medium text-xs">{debugData.connected_as_user_id || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Warning if this is NOT Billy Nelms's ID */}
                  {debugData.connected_as_user_id && debugData.connected_as_user_id !== '149670080' && (
                    <Alert className="border-red-300 bg-red-50 mt-4">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-slate-700">
                        <strong>Wrong Account!</strong> Your OAuth token is connected to PCO user <strong>{debugData.connected_as_user_id}</strong> ({debugData.my_person?.name}), 
                        but you're trying to act as Billy Nelms (149670080). 
                        <br/><br/>
                        <strong>To fix:</strong> Go to Settings → Integrations → Disconnect Planning Center → Reconnect and login as Billy Nelms.
                      </AlertDescription>
                    </Alert>
                  )}

                  {debugData.connected_as_user_id === '149670080' && (
                    <Alert className="border-green-300 bg-green-50 mt-4">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-slate-700">
                        <strong>Correct Account!</strong> You're connected as Billy Nelms (149670080).
                      </AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <p className="text-sm text-slate-500">Token Status</p>
                    <Badge className={debugData.token_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {debugData.token_valid ? 'Valid' : 'Invalid'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Approval Groups */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Approval Groups ({debugData.approval_groups.length})
                    </span>
                    <Badge className="bg-blue-100 text-blue-700">
                      You're in {debugData.my_groups.length} group{debugData.my_groups.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {debugData.approval_groups.map((group) => (
                      <div key={group.id} className={`p-4 rounded-lg border-2 ${group.is_member ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{group.name}</h3>
                          {group.is_member && (
                            <Badge className="bg-green-600 text-white">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Member
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Members: {group.members.length}</p>
                            <div className="mt-1 space-y-1">
                              {group.members.slice(0, 3).map((member) => (
                                <p key={member.id} className="text-xs text-slate-600">• {member.name}</p>
                              ))}
                              {group.members.length > 3 && (
                                <p className="text-xs text-slate-500">+ {group.members.length - 3} more</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-slate-500">Resources: {group.resources.length}</p>
                            <div className="mt-1 space-y-1">
                              {group.resources.slice(0, 3).map((resource) => (
                                <p key={resource.id} className="text-xs text-slate-600">• {resource.name}</p>
                              ))}
                              {group.resources.length > 3 && (
                                <p className="text-xs text-slate-500">+ {group.resources.length - 3} more</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pending Requests */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Pending Requests
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Total: {debugData.pending_requests.length}</Badge>
                      <Badge className="bg-orange-100 text-orange-700">
                        Your Groups: {debugData.my_pending_requests.length}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {debugData.pending_requests.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No pending requests found</p>
                    ) : (
                      debugData.pending_requests.map((request) => {
                        const isMyGroup = debugData.my_pending_requests.some(r => r.id === request.id);
                        return (
                          <div key={request.id} className={`p-3 rounded-lg border ${isMyGroup ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900">{request.event_name}</p>
                                <p className="text-sm text-slate-600">Resource: {request.resource_name}</p>
                                <p className="text-xs text-slate-500">Starts: {request.event_starts_at ? new Date(request.event_starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</p>
                              </div>
                              {isMyGroup && (
                                <Badge className="bg-orange-600 text-white">
                                  Your Group
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* All Resources */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Box className="w-5 h-5" />
                    All Resources ({debugData.resources.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {debugData.resources.slice(0, 12).map((resource) => (
                      <div key={resource.id} className="p-3 border border-slate-200 rounded-lg bg-white">
                        <p className="font-medium text-sm text-slate-900">{resource.name}</p>
                        <p className="text-xs text-slate-500">{resource.kind}</p>
                      </div>
                    ))}
                    {debugData.resources.length > 12 && (
                      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center">
                        <p className="text-sm text-slate-500">+ {debugData.resources.length - 12} more</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="border-2 border-purple-300 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-purple-900">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    {debugData.my_groups.length > 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span>You are in <strong>{debugData.my_groups.length}</strong> approval group{debugData.my_groups.length !== 1 ? 's' : ''}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    {debugData.my_pending_requests.length > 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    )}
                    <span><strong>{debugData.my_pending_requests.length}</strong> pending request{debugData.my_pending_requests.length !== 1 ? 's' : ''} need your approval</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span><strong>{debugData.pending_requests.length}</strong> total pending requests in the system (future events only)</span>
                  </p>
                  
                  {debugData.my_groups.length === 0 && (
                    <Alert className="mt-4 border-yellow-300 bg-yellow-50">
                      <AlertDescription className="text-sm">
                        <strong>Action needed:</strong> You're not in any approval groups. Ask your PCO admin to add you to an approval group in Planning Center Calendar.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {debugData.my_groups.length > 0 && debugData.my_pending_requests.length === 0 && (
                    <Alert className="mt-4 border-green-300 bg-green-50">
                      <AlertDescription className="text-sm">
                        <strong>All good!</strong> You're in approval groups, but there are no pending requests that need your approval right now.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
