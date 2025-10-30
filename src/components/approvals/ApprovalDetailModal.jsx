import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Calendar,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ApprovalDetailModal({ 
  approval, 
  approvalDetails, 
  loadingDetails,
  open, 
  onClose, 
  onSuccess,
  onApprove,
  onDeny,
  user
}) {
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);

  const handleApprove = async () => {
    if (!approval || !onApprove) return;
    
    setApproving(true);
    try {
      await onApprove(approval);
      // onApprove handles success and calls onSuccess
    } catch (error) {
      console.error('Modal approve error:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleDeny = async () => {
    if (!approval || !onDeny) return;
    
    setDenying(true);
    try {
      await onDeny();
      // onDeny handles success
    } catch (error) {
      console.error('Modal deny error:', error);
    } finally {
      setDenying(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  // Don't render if no approval
  if (!approval) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" hideClose>
        {/* Header with custom X button */}
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="flex items-center gap-2 text-xl pr-8">
            <Calendar className="w-5 h-5 text-orange-500" />
            Request Details
          </DialogTitle>
        </DialogHeader>

        {loadingDetails ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Info */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Event Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Event:</span>
                  <span className="ml-2 font-medium">{approval.event_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Date:</span>
                  <span className="ml-2 font-medium">
                    {approval.event_starts_at 
                      ? format(new Date(approval.event_starts_at), 'MMM d, yyyy h:mm a')
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Resource:</span>
                  <span className="ml-2 font-medium">{approval.resource_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Approval Group:</span>
                  <Badge variant="secondary" className="ml-2">
                    {approval.approval_group_name}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Questions & Answers */}
            {approvalDetails?.questions && approvalDetails.questions.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Request Details
                </h3>
                <div className="space-y-4">
                  {approvalDetails.questions.map((question) => {
                    const answer = approvalDetails.answers?.[question.id];
                    return (
                      <div key={question.id} className="border-l-2 border-slate-200 pl-4">
                        <p className="font-medium text-slate-700 text-sm mb-1">
                          {question.question}
                        </p>
                        {question.description && (
                          <p className="text-xs text-slate-500 mb-2 italic">
                            {question.description}
                          </p>
                        )}
                        <div className="bg-slate-50 rounded px-3 py-2">
                          <p className="text-sm text-slate-700">
                            {answer || '(Unanswered)'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Debug Info (collapsible) */}
            {approvalDetails?.diag && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                  ▶ Debug Info
                </summary>
                <pre className="mt-2 bg-slate-100 p-2 rounded overflow-auto max-h-48">
                  {JSON.stringify(approvalDetails.diag, null, 2)}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Return to Approvals
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeny}
                disabled={denying || approving}
                className="flex-1"
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