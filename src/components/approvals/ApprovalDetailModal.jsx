
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, Calendar, Package, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ApprovalDetailModal({ 
  approval, 
  isOpen, 
  onClose, 
  onComplete 
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && approval) {
      loadDetails();
    }
  }, [isOpen, approval]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      console.log('✅ Got approval details:', response.data);
      setDetails(response.data);
    } catch (error) {
      console.error('Error loading details:', error);
      toast.error('Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  const openPCOApproval = (eventId, requestId) => {
    // Open directly to the approvals page filtered to this event
    // This shows the approve/deny buttons like in your screenshot
    const url = `https://calendar.planningcenteronline.com/approvals?event_id=${eventId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const waitForDecision = async (requestId, onUpdate) => {
    const started = Date.now();
    const timeoutMs = 60_000; // 60 seconds
    const everyMs = 3_000; // 3 seconds

    let last = "P";
    while (Date.now() - started < timeoutMs) {
      try {
        const res = await base44.functions.invoke('getPCORequestStatus', {
          request_id: requestId
        });

        const status = res.data?.approval?.approval_status || "P";
        if (status !== last) {
          last = status;
          onUpdate(status);
        }
        if (status === "A" || status === "R") return status;
      } catch (error) {
        console.error('Polling error:', error);
      }
      await new Promise(r => setTimeout(r, everyMs));
    }
    return last;
  };

  if (!approval) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        aria-describedby="approval-desc" 
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            {approval.event_name}
          </DialogTitle>
          <DialogDescription id="approval-desc" className="text-base">
            Review resource request details
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Event Info Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Event Information
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Date & Time</p>
                  <p className="font-medium">
                    {approval.event_starts_at ? format(new Date(approval.event_starts_at), 'PPP p') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Approval Group</p>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                    {approval.approval_group_name}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Resource Info Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Resource Request
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Resource</p>
                  <p className="font-medium text-lg">{approval.resource_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Quantity</p>
                  <p className="font-medium">{approval.quantity || 1}</p>
                </div>
              </div>
            </div>

            {/* Questions & Answers */}
            {details?.questions?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border-2 border-slate-200">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  Request Details
                </h3>
                <div className="space-y-4">
                  {details.questions.map((question) => {
                    const answer = details.answers?.[question.id];
                    if (!answer) return null;

                    return (
                      <div key={question.id} className="pb-4 border-b border-slate-100 last:border-0">
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                          {question.question}
                        </p>
                        <p className="text-slate-900 bg-slate-50 p-3 rounded-lg">
                          {answer}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={onClose} variant="outline" disabled={processing}>
                Close
              </Button>

              <Button
                onClick={() => openPCOApproval(approval.event_id, approval.request_id)}
                variant="outline"
                className="border-blue-300 hover:bg-blue-50 gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Planning Center
              </Button>

              <Button
                onClick={async () => {
                  setProcessing(true);
                  toast.message("⏳ Waiting for decision in Planning Center...");
                  
                  const result = await waitForDecision(String(approval.request_id), (status) => {
                    if (status === "A") {
                      toast.success("✅ Approved in Planning Center!");
                    } else if (status === "R") {
                      toast.error("❌ Rejected in Planning Center");
                    }
                  });
                  
                  setProcessing(false);
                  
                  if (result === "A" || result === "R") {
                    onComplete?.();
                    onClose?.();
                  } else {
                    toast.info("No decision detected yet. You can keep this open or refresh later.");
                  }
                }}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2"
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Check for Decision
              </Button>
            </div>

            {/* Helper text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong>How it works:</strong> Click "Open in Planning Center" to see the approval page with Approve/Reject buttons. 
                After you make your decision in PCO, come back here and click "Check for Decision" to sync the status.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
