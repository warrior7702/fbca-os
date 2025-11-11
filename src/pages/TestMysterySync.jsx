import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function TestMysterySync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const runSync = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('🔮 Triggering Mystery Resource sync...');
      console.log('📊 User PCO token exists:', !!user?.pco_access_token);
      
      const response = await base44.functions.invoke('monitorMysteryResource');
      
      console.log('✅ Response:', response.data);
      setResult(response.data);
    } catch (err) {
      console.error('❌ Full error:', err);
      console.error('❌ Error response:', err.response);
      
      // Extract detailed error info
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      const errorDetails = err.response?.data?.details;
      const errorStack = err.response?.data?.stack;
      
      setError({
        message: errorMsg,
        details: errorDetails,
        stack: errorStack,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  const hasPCOToken = user && user.pco_access_token;

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Test Mystery Resource Sync</h1>
            <p className="text-slate-600">Manually trigger the PCO Mystery Resource monitor</p>
          </div>
        </div>

        {/* Connection Status */}
        {user && (
          <Card className={hasPCOToken ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {hasPCOToken ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {hasPCOToken ? 'PCO Connected' : 'PCO Not Connected'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {hasPCOToken 
                      ? `Logged in as: ${user.email}` 
                      : 'Please connect Planning Center in Settings → Integrations'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Button */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Click the button below to manually trigger the Mystery Resource sync. This will:
            </p>
            <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 ml-2">
              <li>Scan PCO Calendar for events with "Mystery Resource"</li>
              <li>Create WorkflowRequests in Base44</li>
              <li>Send email notifications to event owners</li>
            </ul>

            <Button
              onClick={runSync}
              disabled={loading || !hasPCOToken}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Running Sync...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Run Mystery Resource Sync
                </>
              )}
            </Button>

            {!hasPCOToken && (
              <Alert className="border-yellow-300 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  You must connect Planning Center Online before running the sync.
                  Go to Settings → Integrations to connect.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert className="border-red-300 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              <div className="space-y-2">
                <p><strong>Error:</strong> {error.message}</p>
                {error.status && <p className="text-sm">Status: {error.status}</p>}
                {error.details && <p className="text-sm">{error.details}</p>}
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold">View Stack Trace</summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-48">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Results */}
        {result && (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle2 className="w-5 h-5" />
                Sync Complete!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {result.found || 0}
                  </p>
                  <p className="text-xs text-slate-600">Mystery Resources Found</p>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {result.new_requests_created || 0}
                  </p>
                  <p className="text-xs text-slate-600">Requests Created</p>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {result.emails_sent || 0}
                  </p>
                  <p className="text-xs text-slate-600">Emails Sent</p>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-700">
                    {result.events_checked || 0}
                  </p>
                  <p className="text-xs text-slate-600">Events Checked</p>
                </div>
              </div>

              {result.new_requests_created > 0 && (
                <Alert className="bg-blue-50 border-blue-300">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    <strong>Success!</strong> Created {result.new_requests_created} new communication request(s) 
                    and sent {result.emails_sent || 0} notification email(s).
                  </AlertDescription>
                </Alert>
              )}

              {result.new_requests_created === 0 && (
                <Alert className="bg-yellow-50 border-yellow-300">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-900">
                    No new Mystery Resource events found. Either all events have been processed 
                    or there are no pending Mystery Resource requests.
                  </AlertDescription>
                </Alert>
              )}

              {/* New Requests Details */}
              {result.new_requests && result.new_requests.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-sm text-slate-900 mb-2">New Requests Created:</h3>
                  <div className="space-y-2">
                    {result.new_requests.map((req, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border border-slate-200">
                        <p className="font-mono text-xs text-blue-600 mb-1">{req.request_number}</p>
                        <p className="font-semibold text-sm">{req.title}</p>
                        <p className="text-xs text-slate-500">ID: {req.id}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Results */}
              {result.email_results && result.email_results.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-sm text-slate-900 mb-2">Email Notifications:</h3>
                  <div className="space-y-2">
                    {result.email_results.map((email, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded border ${
                          email.email_sent 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {email.email_sent ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">
                            {email.email_sent ? `Sent to: ${email.recipient}` : 'Failed to send'}
                          </span>
                        </div>
                        {!email.email_sent && email.error && (
                          <p className="text-xs text-red-600 mt-1 ml-6">{email.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON (collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                  View Raw Response (Developer)
                </summary>
                <pre className="mt-2 p-4 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>After running the sync:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Check <strong>WorkflowHub</strong> for new communication requests</li>
              <li>Verify event owners received notification emails</li>
              <li>The cron job will run this automatically every 5 minutes</li>
            </ol>

            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold mb-2">Debugging Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
                <li>Check browser console (F12) for detailed error logs</li>
                <li>Verify you have PCO Calendar access in Planning Center</li>
                <li>Make sure your PCO token hasn't expired (try reconnecting)</li>
                <li>Check that "Mystery Resource" exists in your PCO resources</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}