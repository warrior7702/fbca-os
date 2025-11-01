import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleMakeAdmin = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('forceAdminRole');
      console.log('✅ Response:', response.data);
      setResult(response.data);
      toast.success('Admin role granted! Refreshing...');
      setTimeout(() => {
        window.location.href = '/Settings?tab=admin';
      }, 2000);
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message || 'Failed to update role');
      toast.error('Failed to make admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-600" />
            Admin Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">
            Click the button below to grant yourself admin privileges for FBCA OS.
          </p>

          <Button 
            onClick={handleMakeAdmin} 
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Granting Admin...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Make Me Admin
              </>
            )}
          </Button>

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-900">Success!</p>
                  <p className="text-green-700">Email: {result.email}</p>
                  <p className="text-green-700">Old role: {result.old_role || 'user'}</p>
                  <p className="text-green-700">New role: {result.new_role}</p>
                  <p className="text-green-600 mt-2">Redirecting to Settings...</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 pt-4 border-t">
            <p>This page allows you to grant yourself admin access to manage users, door codes, and other system settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}