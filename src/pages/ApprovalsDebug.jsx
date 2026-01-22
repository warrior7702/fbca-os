import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function ApprovalsDebug() {
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState(null);

  const runDebug = async () => {
    setLoading(true);
    const debug = {
      timestamp: new Date().toISOString(),
      user: null,
      userGroups: [],
      allApprovals: [],
      filteredApprovals: [],
      matches: [],
      noMatches: []
    };

    try {
      // Get user
      const user = await base44.auth.me();
      debug.user = {
        email: user?.email,
        hasPCOToken: !!user?.pco_access_token
      };

      // Get user groups
      const groupsResponse = await fetch(
        `https://pco-webhook.vercel.app/api/cron/pco-sync?userGroups=1&email=${encodeURIComponent(user.email)}`
      );
      const groupsData = await groupsResponse.json();
      debug.userGroups = groupsData.approvalGroupNames || [];

      // Get all approvals
      const approvalsResponse = await fetch(
        `https://pco-webhook.vercel.app/api/cron/pco-sync?approvals=1&windowDays=30&maxEvents=100&email=${encodeURIComponent(user.email)}`
      );
      const approvalsData = await approvalsResponse.json();
      debug.allApprovals = approvalsData.approvals || [];

      // Filter and track matches
      debug.allApprovals.forEach(approval => {
        const approvalGroupNames = approval.approvalGroups?.map(g => g.name) || [];
        const hasMatch = approvalGroupNames.some(name => debug.userGroups.includes(name));
        
        if (hasMatch) {
          debug.matches.push({
            eventName: approval.eventName,
            resourceName: approval.resourceName,
            approvalGroups: approvalGroupNames,
            matchingGroups: approvalGroupNames.filter(name => debug.userGroups.includes(name))
          });
          debug.filteredApprovals.push(approval);
        } else {
          debug.noMatches.push({
            eventName: approval.eventName,
            resourceName: approval.resourceName,
            approvalGroups: approvalGroupNames
          });
        }
      });

    } catch (error) {
      debug.error = error.message;
    }

    setDebugData(debug);
    setLoading(false);
  };

  useEffect(() => {
    runDebug();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!debugData) {
    return (
      <div className="p-6">
        <Button onClick={runDebug}>Run Debug</Button>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Approvals Debug</h1>
          <Button onClick={runDebug} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              User Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">Email:</span> {debugData.user?.email || 'Not found'}
            </div>
            <div>
              <span className="font-semibold">PCO Connected:</span>{' '}
              <Badge variant={debugData.user?.hasPCOToken ? 'default' : 'destructive'}>
                {debugData.user?.hasPCOToken ? 'Yes' : 'No'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* User Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Your Approval Groups ({debugData.userGroups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debugData.userGroups.length === 0 ? (
              <p className="text-red-600">❌ No approval groups found!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {debugData.userGroups.map(group => (
                  <Badge key={group} variant="outline">{group}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">Total Approvals from API:</span> {debugData.allApprovals.length}
            </div>
            <div>
              <span className="font-semibold">Approvals Matching Your Groups:</span>{' '}
              <span className={debugData.filteredApprovals.length > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>
                {debugData.filteredApprovals.length}
              </span>
            </div>
            <div>
              <span className="font-semibold">Approvals NOT Matching:</span> {debugData.noMatches.length}
            </div>
          </CardContent>
        </Card>

        {/* Matches */}
        {debugData.matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                ✅ Matching Approvals ({debugData.matches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {debugData.matches.map((match, i) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold">{match.eventName}</div>
                  <div className="text-sm text-slate-600">{match.resourceName}</div>
                  <div className="text-xs mt-2">
                    <span className="font-semibold">Matching Groups:</span>{' '}
                    {match.matchingGroups.join(', ')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* No Matches */}
        {debugData.noMatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                ❌ Non-Matching Approvals ({debugData.noMatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {debugData.noMatches.slice(0, 5).map((noMatch, i) => (
                <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold">{noMatch.eventName}</div>
                  <div className="text-sm text-slate-600">{noMatch.resourceName}</div>
                  <div className="text-xs mt-2">
                    <span className="font-semibold">Their Groups:</span>{' '}
                    {noMatch.approvalGroups.join(', ')}
                  </div>
                  <div className="text-xs mt-1 text-red-700">
                    ⚠️ None of these groups match your groups: {debugData.userGroups.join(', ')}
                  </div>
                </div>
              ))}
              {debugData.noMatches.length > 5 && (
                <p className="text-sm text-slate-500">...and {debugData.noMatches.length - 5} more</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {debugData.error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{debugData.error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}