import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSetup() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Making you a Super User...');

  useEffect(() => {
    const makeAdmin = async () => {
      try {
        const response = await base44.functions.invoke('makeWarriorAdmin');
        console.log('✅ Success:', response.data);
        setStatus('success');
        setMessage(response.data.message);
        
        setTimeout(() => {
          window.location.href = '/Settings?tab=admin';
        }, 2000);
      } catch (error) {
        console.error('❌ Error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to grant Super User access');
      }
    };
    
    makeAdmin();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            Super User Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          {status === 'loading' && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto" />
              <p className="text-slate-600">{message}</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <div>
                <p className="font-semibold text-green-900">{message}</p>
                <p className="text-sm text-slate-600 mt-2">Redirecting to Settings...</p>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-red-600">❌</div>
              <p className="text-red-700">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}