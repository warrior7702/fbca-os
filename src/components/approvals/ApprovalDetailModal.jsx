import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ApprovalDetailModal({ approval, open, onClose, onApprovalAction }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);

  useEffect(() => {
    if (open && approval) {
      loadDetails();
    }
  }, [open, approval]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      // Use V2 endpoint
      const response = await base44.functions.invoke('getApprovalDetailsV2', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      console.log('📦 Approval details response:', response.data);
      
      if (response.data.ok) {
        setDetails(response.data);
      } else {
        console.error('Details response not ok:', response.data);
        toast.error('Failed to load approval details');
      }
    } catch (error) {
      console.error('Failed to load approval details:', error);
      toast.error('Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });

      if (response.data.success) {
        toast.success('Request approved!');
        onApprovalAction?.();
        onClose();
      } else {
        toast.error('Failed to approve request');
      }
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Failed to approve request');
    } finally {
      setApproving(false);
    }
  };

  const handleDeny = async () => {
    setDenying(true);
    try {
      const response = await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.request_id
      });

      if (response.data.success) {
        toast.success('Request denied');
        onApprovalAction?.();
        onClose();
      } else {
        toast.error('Failed to deny request');
      }
    } catch (error) {
      console.error('Deny error:', error);
      toast.error('Failed to deny request');
    } finally {
      setDenying(false);
    }
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{approval.event_name}</DialogTitle>
          <p className="text-sm text-slate-500">Review resource request details and answers</p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">
                  {format(new Date(approval.event_starts_at), 'EEEE, MMMM do, yyyy h:mm a')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="w-4 h-4" />
                <span>{approval.resource_name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4" />
                <span>Requested {format(new Date(approval.pco_created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>

            <Separator />

            {/* Resource Badge */}
            <div>
              <Badge className="bg-orange-100 text-orange-700 text-sm px-3 py-1">
                {approval.approval_group_name}
              </Badge>
            </div>

            {/* Questions & Answers */}
            {details?.questions && details.questions.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Resource Request Details</h3>
                {details.questions.map((q) => {
                  const answer = details.answers?.[q.id];
                  return (
                    <div key={q.id} className="p-4 bg-slate-50 rounded-lg">
                      <p className="font-medium text-slate-900 mb-2">
                        {q.question}
                        {q.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {q.description && (
                        <p className="text-sm text-slate-500 mb-2">{q.description}</p>
                      )}
                      <div className="mt-2">
                        {answer ? (
                          <p className="text-slate-700 bg-white px-3 py-2 rounded border border-slate-200">
                            {answer}
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">No answer provided</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <AlertCircle className="w-12 h-12 mb-3 text-slate-300" />
                <p>No resource questions for this request</p>
              </div>
            )}

            {!details?.booking_found && details?.questions?.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">No booking found</p>
                  <p className="mt-1">This request may not have been submitted with answers yet, or the resource booking hasn't been created in Planning Center.</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={approving || denying}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={handleDeny}
                disabled={approving || denying}
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                {denying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Denying...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Deny
                  </>
                )}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approving || denying}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {approving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}