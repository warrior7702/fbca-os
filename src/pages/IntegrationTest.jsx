import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

export default function IntegrationTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      console.log('Testing PCO connection...');
      const response = await base44.functions.invoke('testPCO');
      console.log('PCO test response:', response.data);
      setResults({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('PCO test error:', error);
      setResults({
        success: false,
        error: error.response?.data || error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const testCalendarEvents = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      console.log('Testing PCO calendar events...');
      const response = await base44.functions.invoke('getPCOCalendarEvents');
      console.log('Calendar events response:', response.data);
      setResults({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('Calendar events error:', error);
      setResults({
        success: false,
        error: error.response?.data || error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const testApprovals = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      console.log('Testing PCO approvals...');
      const response = await base44.functions.invoke('getMyPendingApprovals');
      console.log('Approvals response:', response.data);
      setResults({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('Approvals error:', error);
      setResults({
        success: false,
        error: error.response?.data || error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Integration Test</h1>
          <p className="text-slate-600">Test your Planning Center connection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={runTest} 
              disabled={testing}
              className="w-full"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Test Basic PCO Connection
            </Button>

            <Button 
              onClick={testCalendarEvents} 
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Test Calendar Events
            </Button>

            <Button 
              onClick={testApprovals} 
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Test My Approvals
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Alert variant={results.success ? "default" : "destructive"}>
            {results.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">
                  {results.success ? 'Test Passed ✓' : 'Test Failed ✗'}
                </p>
                <pre className="mt-2 p-3 bg-slate-900 text-white rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(results.success ? results.data : results.error, null, 2)}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>1. Click "Test Basic PCO Connection" first to verify your token works</p>
            <p>2. If that passes, try "Test Calendar Events" to check the calendar API</p>
            <p>3. Then try "Test My Approvals" to check approval groups</p>
            <p>4. Check the results below and the browser console (F12) for detailed logs</p>
            <p className="mt-4 text-xs text-slate-500">
              If tests fail with token errors, go to Settings → Integrations and reconnect Planning Center
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}