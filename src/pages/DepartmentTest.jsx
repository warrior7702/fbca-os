
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users,
  Building2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Search,
  Crown,
  RefreshCw,
  Cloud,
  Database,
  CheckCircle,
  XCircle,
  ArrowRight,
  Link as LinkIcon,
  Bug,
  LogOut,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function DepartmentTest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [testingAuth, setTestingAuth] = useState(false);
  const [debuggingTokens, setDebuggingTokens] = useState(false); // New state for token debugging
  const [o365Data, setO365Data] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [tokenDebugResults, setTokenDebugResults] = useState(null); // New state for token debug results

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user?.role !== 'admin' && user?.role !== 'super_user') {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setTestingAuth(true);
    try {
      console.log('🧪 Testing authentication...');
      const response = await base44.functions.invoke('testAuth');
      console.log('📥 Test response:', response.data);
      
      if (response.data?.success) {
        toast.success('✅ Authentication test passed!');
        console.log('✅ User info:', response.data.user);
      } else {
        toast.error('❌ Authentication test failed');
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      toast.error('Authentication test failed: ' + error.message);
    } finally {
      setTestingAuth(false);
    }
  };

  // New debugTokens function
  const debugTokens = async () => {
    setDebuggingTokens(true);
    setTokenDebugResults(null); // Clear previous results
    try {
      console.log('🔍 Debugging Microsoft tokens...');
      const response = await base44.functions.invoke('debugMicrosoftTokens');
      console.log('📥 Debug results:', response.data);
      
      if (response.data?.success) {
        setTokenDebugResults(response.data.results);
        toast.success('✅ Token debugging complete! Check results below.');
      } else {
        toast.error('❌ Token debugging failed');
      }
    } catch (error) {
      console.error('❌ Debug error:', error);
      toast.error('Token debugging failed: ' + error.message);
    } finally {
      setDebuggingTokens(false);
    }
  };

  const scanO365 = async () => {
    setScanning(true);
    setConnectionError(null);
    try {
      console.log('🔍 Starting department scan...');
      
      // Use the EXISTING scanO365Departments function
      const response = await base44.functions.invoke('scanO365Departments');
      console.log('📥 Scan response:', response.data);
      
      if (response.data?.success) {
        setO365Data(response.data);
        const tokenInfo = response.data.tokenSource === 'SSO' ? '(using SSO)' : '(using manual connection)';
        toast.success(`✅ Scanned ${response.data.users.length} users ${tokenInfo}`);
      } else {
        // Handle specific error types
        if (response.data?.needsConnection) {
          setConnectionError({
            type: 'connection',
            message: response.data.error,
            details: response.data.details
          });
        } else if (response.data?.needsReconnection) {
          setConnectionError({
            type: 'reconnection',
            message: response.data.error,
            details: response.data.details,
            tokenSource: response.data.tokenSource
          });
        } else if (response.data?.needsRelogin) {
          setConnectionError({
            type: 'relogin',
            message: response.data.error,
            details: response.data.details
          });
        } else if (response.data?.needsPermissions) {
          setConnectionError({
            type: 'permissions',
            message: response.data.error,
            details: response.data.details
          });
        } else {
          setConnectionError({
            type: 'error',
            message: response.data?.error || 'Failed to scan O365',
            details: response.data?.details
          });
        }
        toast.error(response.data?.error || 'Failed to scan O365');
      }
    } catch (error) {
      console.error('❌ Scan error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status
      });
      
      setConnectionError({
        type: 'error',
        message: 'Failed to scan Microsoft 365',
        details: error.message + (error.response?.status ? ` (HTTP ${error.response.status})` : '')
      });
      toast.error('Failed to scan Microsoft 365');
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnectMicrosoft = async () => {
    if (!confirm('This will disconnect your manual Microsoft connection. Continue?')) { // Updated confirmation message
      return;
    }
    
    try {
      await base44.auth.updateMe({
        microsoft_access_token: null,
        microsoft_refresh_token: null,
        microsoft_token_expires_at: null
      });
      toast.success('Manual Microsoft connection removed.'); // Simplified toast message
      loadData();
      setConnectionError(null);
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const handleRelogin = () => {
    toast.info('Logging out to refresh your session...');
    setTimeout(() => {
      base44.auth.logout();
    }, 1000);
  };

  const filteredUsers = o365Data?.users?.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.o365Department?.toLowerCase().includes(query) ||
      user.o365JobTitle?.toLowerCase().includes(query)
    );
  }) || [];

  const groupByDepartment = () => {
    const groups = {};
    filteredUsers.forEach(user => {
      const dept = user.o365Department || '(No Department)';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(user);
    });
    return groups;
  };

  const departmentGroups = groupByDepartment();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Settings') + '?tab=admin')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              Token Debugger & Department Scanner {/* Updated title */}
              <Crown className={`w-5 h-5 ${currentUser?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
            </h1>
            <p className="text-slate-600">Debug Microsoft tokens and scan O365 departments</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={testAuth}
              disabled={testingAuth}
              variant="outline"
              size="sm"
            >
              <Bug className={`w-4 h-4 mr-2 ${testingAuth ? 'animate-spin' : ''}`} />
              {testingAuth ? 'Testing...' : 'Test Auth'}
            </Button>
            {/* New Debug Tokens Button */}
            <Button
              onClick={debugTokens}
              disabled={debuggingTokens}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Zap className={`w-4 h-4 mr-2 ${debuggingTokens ? 'animate-spin' : ''}`} />
              {debuggingTokens ? 'Debugging...' : 'Debug Tokens'}
            </Button>
            <Button
              onClick={scanO365}
              disabled={scanning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan O365'}
            </Button>
          </div>
        </div>

        {/* Token Debug Results */}
        {tokenDebugResults && (
          <Card className="mb-6 border-purple-300 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Token Debug Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manual Token */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  🔑 Manual Token
                  {tokenDebugResults.manualTest?.success ? (
                    <Badge className="bg-green-100 text-green-700">✅ Works</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">❌ Failed</Badge>
                  )}
                </h3>
                {tokenDebugResults.manualToken?.exists ? (
                  <div className="text-sm space-y-1 font-mono">
                    <p>• Length: {tokenDebugResults.manualToken.length}</p>
                    <p>• Valid JWT: {tokenDebugResults.manualToken.isValidJWT ? '✅' : '❌'} ({tokenDebugResults.manualToken.parts} parts)</p>
                    <p>• Has spaces: {tokenDebugResults.manualToken.hasSpaces ? '⚠️ Yes' : '✅ No'}</p>
                    {tokenDebugResults.manualTest?.success && (
                      <p className="text-green-700">✅ Successfully retrieved {tokenDebugResults.manualTest.usersReturned} users from Microsoft</p>
                    )}
                    {tokenDebugResults.manualTest?.error && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-700">❌ Error Details</summary>
                        <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto max-h-40">{JSON.stringify(tokenDebugResults.manualTest, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No manual token found</p>
                )}
              </div>

              {/* SSO Token */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  🔐 SSO Token
                  {tokenDebugResults.ssoTest?.success ? (
                    <Badge className="bg-green-100 text-green-700">✅ Works</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">❌ Failed</Badge>
                  )}
                </h3>
                {tokenDebugResults.ssoToken?.exists ? (
                  <div className="text-sm space-y-1 font-mono">
                    <p>• Length: {tokenDebugResults.ssoToken.length}</p>
                    <p>• Parts: {tokenDebugResults.ssoToken.parts}</p>
                    <p>• Has spaces: {tokenDebugResults.ssoToken.hasSpaces ? '⚠️ Yes' : '✅ No'}</p>
                    <p>• Has Bearer prefix: {tokenDebugResults.ssoToken.hasBearerPrefix ? '⚠️ Yes' : '✅ No'}</p>
                    {tokenDebugResults.ssoToken.cleaned && (
                      <p>• After cleaning: {tokenDebugResults.ssoToken.cleaned.parts} parts (Valid JWT: {tokenDebugResults.ssoToken.cleaned.isValidJWT ? '✅' : '❌'})</p>
                    )}
                    {tokenDebugResults.ssoTest?.success && (
                      <p className="text-green-700">✅ Successfully retrieved {tokenDebugResults.ssoTest.usersReturned} users from Microsoft</p>
                    )}
                    {tokenDebugResults.ssoTest?.error && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-700">❌ Error Details</summary>
                        <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto max-h-40">{JSON.stringify(tokenDebugResults.ssoTest, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    {tokenDebugResults.ssoToken?.reason || 'No SSO token found'}
                  </p>
                )}
              </div>

              {/* Recommendation */}
              <div className="bg-blue-100 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">💡 Recommendation</h3>
                <p className="text-sm">{tokenDebugResults.comparison?.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Error */}
        {connectionError && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-1">
                    {connectionError.message}
                  </h3>
                  <p className="text-sm text-red-800 mb-3">
                    {connectionError.details}
                  </p>
                  
                  {connectionError.type === 'relogin' && (
                    <Button 
                      onClick={handleRelogin}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out & Back In
                    </Button>
                  )}
                  
                  {connectionError.type === 'reconnection' && ( // Simplified this block as it no longer specifies 'Manual'
                    <Button 
                      onClick={handleDisconnectMicrosoft}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Remove Manual Connection
                    </Button>
                  )}

                  {/* Removed connection.type === 'connection' which led to integrations tab */}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Updated initial state card content */}
        {!o365Data ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Cloud className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Ready to Scan
              </h3>
              <p className="text-slate-600 mb-6">
                First, click "Debug Tokens" to see which token works. Then click "Scan O365" to retrieve department data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Total Users</p> {/* Changed title */}
                      <p className="text-2xl font-bold text-slate-900">{o365Data.stats.total}</p>
                    </div>
                    <Cloud className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">With Department</p>
                      <p className="text-2xl font-bold text-green-700">{o365Data.stats.withDepartment}</p>
                      {/* Removed percentage */}
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">No Department</p>
                      <p className="text-2xl font-bold text-red-700">{o365Data.stats.withoutDepartment}</p>
                      {/* Removed percentage */}
                    </div>
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Replaced "Needs Sync" card with "Unique Departments" */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Unique Departments</p>
                      <p className="text-2xl font-bold text-purple-700">{o365Data.uniqueDepartments.length}</p>
                      {/* Removed 'to Base44' text */}
                    </div>
                    <Building2 className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Removed Token Source Info Card */}

            {/* Department List - compact */}
            {o365Data.uniqueDepartments.length > 0 && ( // Conditional render
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-sm">Departments Found</CardTitle> {/* Changed title */}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {o365Data.uniqueDepartments.map((dept) => (
                      <Badge key={dept} variant="outline" className="text-xs"> {/* Changed badge size */}
                        {dept}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Removed Search and Users List sections entirely */}
          </>
        )}
      </div>
    </div>
  );
}
