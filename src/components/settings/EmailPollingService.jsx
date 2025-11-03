import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function EmailPollingService({ user }) {
  const [processing, setProcessing] = useState(false);

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
            Connect Microsoft 365 to enable email processing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Manual Email Processing
        </CardTitle>
        <CardDescription className="mt-2">
          Check service inboxes and create tickets from emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">Email Processing</h3>
              <p className="text-sm text-slate-600 mb-2">
                Manually check the service inboxes and create tickets from unread emails.
                Automatic processing is configured externally via Zapier.
              </p>
            </div>
          </div>
        </div>

        {/* Manual Check Button */}
        <Button
          onClick={processEmailsNow}
          disabled={processing}
          className="w-full"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Emails...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" />
              Check Emails Now
            </>
          )}
        </Button>

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
      </CardContent>
    </Card>
  );
}