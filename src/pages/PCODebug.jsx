
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
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
  AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";

export default function PCODebug() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [error, setError] = useState(null);
  const [testingNote, setTestingNote] = useState(false);
  const [noteTestResult, setNoteTestResult] = useState(null);

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
    setNoteTestResult(null);

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
        connected_as_user_id: tokenUserId,
        my_person: null,
        connected_as_email: null,
        approval_groups: [],
        my_groups: [],
        resources: [],
        my_pending_requests: [] // Will come from database
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
      }

      // Get all approval groups
      const groupsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        console.log('✅ Found', groupsData.data?.length, 'approval groups');

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

      // Get pending requests from DATABASE (same source as My Approvals page)
      console.log('📥 Fetching pending approvals from database...');
      const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
      data.my_pending_requests = approvalsResponse.data.pending_approvals || [];
      console.log('✅ Found', data.my_pending_requests.length, 'pending approvals in database');

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

  const testWriteNote = async () => {
    if (!debugData?.my_pending_requests?.length) {
      toast.error('No pending requests to test with');
      return;
    }

    setTestingNote(true);
    setNoteTestResult(null);

    try {
      const firstRequest = debugData.my_pending_requests[0];
      
      console.log('🧪 Testing badge code write on request:', firstRequest.request_id);
      
      const response = await base44.functions.invoke('writePCONote', {
        request_id: firstRequest.request_id,
        badge_code: `123456# (TEST from FBCA OS at ${new Date().toLocaleTimeString()})`
      });

      console.log('✅ Badge code write response:', response.data);
      
      if (response.data.ok) {
        setNoteTestResult({
          success: true,
          message: 'Successfully wrote badge code to Notes tab!',
          request_id: firstRequest.request_id,
          event_name: firstRequest.event_name,
          note: response.data.note
        });
        toast.success('Badge code written successfully!');
      } else {
        setNoteTestResult({
          success: false,
          message: response.data.error || 'Failed to write badge code',
          details: response.data
        });
        toast.error('Failed to write badge code');
      }

    } catch (error) {
      console.error('❌ Badge code test failed:', error);
      setNoteTestResult({
        success: false,
        message: error.message,
        details: error.response?.data
      });
      toast.error('Test failed: ' + error.message);
    } finally {
      setTestingNote(false);
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

          <div className="flex gap-2">
            {debugData?.my_pending_requests?.length > 0 && (
              <Button
                onClick={testWriteNote}
                disabled={testingNote}
                variant="outline"
                className="border-green-300 hover:bg-green-50"
              >
                {testingNote ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Test Write Badge Code
              </Button>
            )}
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

        {/* Note Test Result */}
        {noteTestResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className={noteTestResult.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {noteTestResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  Badge Code Write Test Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`font-medium mb-2 ${noteTestResult.success ? 'text-green-900' : 'text-red-900'}`}>
                  {noteTestResult.message}
                </p>
                {noteTestResult.request_id && (
                  <p className="text-sm text-slate-700">
                    Request ID: <code className="bg-white px-2 py-1 rounded">{noteTestResult.request_id}</code>
                  </p>
                )}
                {noteTestResult.event_name && (
                  <p className="text-sm text-slate-700">
                    Event: {noteTestResult.event_name}
                  </p>
                )}
                {noteTestResult.note && (
                  <p className="text-sm text-slate-700">
                    Note Written: <code className="bg-white px-2 py-1 rounded">{noteTestResult.note}</code>
                  </p>
                )}
                {noteTestResult.details && (
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(noteTestResult.details, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </motion.div>
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

            {/* Pending Requests from Database */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      My Pending Approvals (from Database)
                    </span>
                    <Badge className="bg-orange-100 text-orange-700">
                      {debugData.my_pending_requests.length} approval{debugData.my_pending_requests.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    This shows the same data as your "My Approvals" page (from PendingApproval entity)
                  </p>
                  <div className="space-y-3">
                    {debugData.my_pending_requests.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No pending approvals found</p>
                    ) : (
                      debugData.my_pending_requests.map((request) => (
                        <div key={request.id} className="p-3 rounded-lg border border-orange-300 bg-orange-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{request.event_name}</p>
                              <p className="text-sm text-slate-600">Resource: {request.resource_name}</p>
                              <p className="text-sm text-slate-600">Group: {request.approval_group_name}</p>
                              <p className="text-xs text-slate-500">
                                Starts: {request.event_starts_at ? new Date(request.event_starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </p>
                              <p className="text-xs font-mono text-slate-500 mt-1">
                                Request ID: {request.request_id}
                              </p>
                            </div>
                            <Badge className="bg-orange-600 text-white">
                              Your Group
                            </Badge>
                          </div>
                        </div>
                      ))
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
                    <span><strong>{debugData.my_pending_requests.length}</strong> pending approval{debugData.my_pending_requests.length !== 1 ? 's' : ''} need your action</span>
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
