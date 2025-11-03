import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Zap, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function EmailPollingService({ user }) {
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const setupWebhooks = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('setupEmailWebhooks');
      
      if (response.data.success) {
        setWebhookStatus(response.data);
        toast.success('Email webhooks configured!');
      } else {
        toast.error('Failed to setup webhooks: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Webhook setup error:', error);
      toast.error('Failed to setup webhooks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processEmailsNow = async () => {
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('processServiceEmails');
      
      if (response.data.success) {
        const { summary } = response.data;
        
        if (summary.tickets_created > 0) {
          toast.success(`Created ${summary.tickets_created} ticket(s) from emails`);
        } else {
          toast.info('No new tickets to create');
        }
      }
    } catch (error) {
      console.error('❌ Email processing error:', error);
      toast.error('Failed to process emails: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!user?.microsoft_access_token) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900">
            <AlertCircle className="w-5 h-5" />
            Microsoft 365 Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-800">
            Connect Microsoft 365 to enable automatic email processing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Instant Email Processing
            </CardTitle>
            <CardDescription className="mt-2">
              Tickets are created automatically when emails arrive
            </CardDescription>
          </div>
          {webhookStatus?.success && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">How It Works</h3>
              <p className="text-sm text-slate-600 mb-2">
                When an email arrives in any monitored inbox, Microsoft 365 immediately 
                notifies our system and a ticket is created within seconds.
              </p>
              <p className="text-xs text-slate-500">
                No browser tab needed - this runs 24/7 on the server.
              </p>
            </div>
          </div>
        </div>

        {/* Webhook Status */}
        {webhookStatus && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-slate-700">Active Webhooks</h4>
            <div className="space-y-2">
              {webhookStatus.results?.map((result, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium text-slate-700">
                      {result.mailbox}
                    </span>
                  </div>
                  {result.success && result.expiresAt && (
                    <span className="text-xs text-slate-500">
                      Expires {new Date(result.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={setupWebhooks}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting Up...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                {webhookStatus ? 'Renew Webhooks' : 'Enable Instant Processing'}
              </>
            )}
          </Button>

          <Button
            onClick={processEmailsNow}
            disabled={processing}
            className="w-full"
            variant="outline"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Check Emails Now (Manual)
              </>
            )}
          </Button>
        </div>

        {/* Monitored Inboxes */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Monitored Inboxes</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-slate-600">maintenance@fbca.org</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-slate-600">support@fbca.org</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-slate-600">cleaning@fbca.org</span>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> Microsoft webhooks expire after 3 days. 
            Click "Renew Webhooks" to extend for another 3 days.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}