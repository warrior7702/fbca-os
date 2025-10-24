import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare, Mail, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function IntegrationTest() {
  const [loading, setLoading] = useState({ pco: false, clickup: false, microsoft: false });
  const [data, setData] = useState({ pco: null, clickup: null, microsoft: null });
  const [errors, setErrors] = useState({ pco: null, clickup: null, microsoft: null });

  const testPCO = async () => {
    setLoading(prev => ({ ...prev, pco: true }));
    setErrors(prev => ({ ...prev, pco: null }));
    try {
      const response = await base44.functions.invoke('testPCO');
      setData(prev => ({ ...prev, pco: response.data }));
      toast.success('Planning Center data loaded!');
    } catch (error) {
      setErrors(prev => ({ ...prev, pco: error.response?.data?.error || error.message }));
      toast.error('Failed to load Planning Center data');
    } finally {
      setLoading(prev => ({ ...prev, pco: false }));
    }
  };

  const testClickUp = async () => {
    setLoading(prev => ({ ...prev, clickup: true }));
    setErrors(prev => ({ ...prev, clickup: null }));
    try {
      const response = await base44.functions.invoke('testClickUp');
      setData(prev => ({ ...prev, clickup: response.data }));
      toast.success('ClickUp data loaded!');
    } catch (error) {
      setErrors(prev => ({ ...prev, clickup: error.response?.data?.error || error.message }));
      toast.error('Failed to load ClickUp data');
    } finally {
      setLoading(prev => ({ ...prev, clickup: false }));
    }
  };

  const testMicrosoft = async () => {
    setLoading(prev => ({ ...prev, microsoft: true }));
    setErrors(prev => ({ ...prev, microsoft: null }));
    try {
      const response = await base44.functions.invoke('testMicrosoft');
      setData(prev => ({ ...prev, microsoft: response.data }));
      toast.success('Microsoft 365 data loaded!');
    } catch (error) {
      setErrors(prev => ({ ...prev, microsoft: error.response?.data?.error || error.message }));
      toast.error('Failed to load Microsoft 365 data');
    } finally {
      setLoading(prev => ({ ...prev, microsoft: false }));
    }
  };

  const testAll = () => {
    testPCO();
    testClickUp();
    testMicrosoft();
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Integration Test</h1>
            <p className="text-slate-600">Verify your connected services are working</p>
          </div>
          <Button onClick={testAll} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Test All
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Planning Center */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">Planning Center</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={testPCO}
                  disabled={loading.pco}
                >
                  {loading.pco ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              <CardDescription>Calendar & Events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.pco && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              )}
              {errors.pco && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errors.pco}</span>
                </div>
              )}
              {data.pco && !loading.pco && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">User ID</p>
                    <p className="font-mono text-sm">{data.pco.user_id}</p>
                  </div>
                  {data.pco.events && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Upcoming Events</p>
                      <div className="space-y-1">
                        {data.pco.events.slice(0, 3).map((event, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {event.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ClickUp */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-lg">ClickUp</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={testClickUp}
                  disabled={loading.clickup}
                >
                  {loading.clickup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              <CardDescription>Tasks & Projects</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.clickup && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              )}
              {errors.clickup && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errors.clickup}</span>
                </div>
              )}
              {data.clickup && !loading.clickup && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">User Name</p>
                    <p className="font-medium">{data.clickup.user?.username}</p>
                  </div>
                  {data.clickup.teams && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Workspaces</p>
                      <div className="space-y-1">
                        {data.clickup.teams.slice(0, 3).map((team, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {team.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Microsoft 365 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">Microsoft 365</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={testMicrosoft}
                  disabled={loading.microsoft}
                >
                  {loading.microsoft ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              <CardDescription>Email & Calendar</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.microsoft && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              )}
              {errors.microsoft && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errors.microsoft}</span>
                </div>
              )}
              {data.microsoft && !loading.microsoft && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Display Name</p>
                    <p className="font-medium">{data.microsoft.user?.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Email</p>
                    <p className="text-sm">{data.microsoft.user?.mail || data.microsoft.user?.userPrincipalName}</p>
                  </div>
                  {data.microsoft.emails && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Recent Emails</p>
                      <p className="text-sm font-semibold">{data.microsoft.emails.length} emails</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}