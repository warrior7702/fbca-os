import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, CheckCircle, XCircle, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CardholderLookup from "./CardholderLookup";

export default function ApprovalDetailModal({ approval, open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [selectedCardholder, setSelectedCardholder] = useState(null);
  const [sendingToPCO, setSendingToPCO] = useState(false);
  const [sentToPCO, setSentToPCO] = useState(false);

  useEffect(() => {
    if (open && approval) {
      loadDetails();
      setSelectedCardholder(null);
      setSentToPCO(false);
    }
  }, [open, approval]);

  const loadDetails = async () => {
    setLoading(true);
    console.log('🔍 Loading approval details for:', approval.request_id);
    
    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      console.log('📊 Details response:', response.data);
      
      if (response.data?.ok) {
        setDetails(response.data);
        console.log('✅ Questions:', response.data.questions?.length || 0);
        console.log('✅ Answers:', Object.keys(response.data.answers || {}).length);
      } else {
        toast.error(response.data?.error || 'Failed to load details');
      }
    } catch (error) {
      console.error('❌ Failed to load details:', error);
      toast.error('Failed to load details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendToPlanningCenter = async () => {
    if (!selectedCardholder?.pin) {
      toast.error('Please select a cardholder first');
      return;
    }

    setSendingToPCO(true);
    try {
      const badgeCode = `${selectedCardholder.pin}#`;
      
      const response = await base44.functions.invoke('writePCONote', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        badge_code: badgeCode
      });

      if (response.data?.ok) {
        toast.success('Door code sent to Planning Center event activity!');
        setSentToPCO(true);
      } else {
        toast.error('Failed to send to Planning Center: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error sending to PCO:', error);
      toast.error('Failed to send to Planning Center');
    } finally {
      setSendingToPCO(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      console.log('🔍 Approving from modal:', approval.request_id);
      
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id,
        action: 'approve'
      });

      if (response.data?.ok) {
        toast.success('Request approved successfully!');
        onClose();
        if (onSuccess) await onSuccess(); // Trigger refresh in parent
      } else {
        toast.error(response.data?.error || 'Failed to approve');
      }
    } catch (error) {
      console.error('❌ Approve error:', error);
      toast.error('Failed to approve request');
    } finally {
      setApproving(false);
    }
  };

  const handleDeny = async () => {
    setDenying(true);
    try {
      console.log('🔍 Denying from modal:', approval.request_id);
      
      const response = await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id,
        action: 'deny'
      });

      if (response.data?.ok) {
        toast.success('Request denied successfully!');
        onClose();
        if (onSuccess) await onSuccess(); // Trigger refresh in parent
      } else {
        toast.error(response.data?.error || 'Failed to deny');
      }
    } catch (error) {
      console.error('❌ Deny error:', error);
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
          <DialogTitle className="text-xl flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {approval.event_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Event Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Event Date</Label>
                <p className="font-medium">
                  {approval.event_starts_at 
                    ? format(new Date(approval.event_starts_at), 'EEEE, MMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Time</Label>
                <p className="font-medium">
                  {approval.event_starts_at && approval.event_ends_at
                    ? `${format(new Date(approval.event_starts_at), 'h:mm a')} - ${format(new Date(approval.event_ends_at), 'h:mm a')}`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Resource Info */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <Label className="text-xs text-slate-500">Resource Requested</Label>
              <p className="font-semibold text-lg">{approval.resource_name}</p>
              {approval.quantity && approval.quantity > 1 && (
                <p className="text-sm text-slate-600">Quantity: {approval.quantity}</p>
              )}
            </div>

            {/* Questions and Answers */}
            {details?.questions && details.questions.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Request Details</Label>
                {details.questions.map((question) => {
                  const answer = details.answers?.[question.id];
                  if (!answer) return null;
                  
                  return (
                    <div key={question.id} className="p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs text-slate-500">{question.question}</Label>
                      <p className="text-sm mt-1">{answer}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cardholder Lookup */}
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-2 block">Assign Door Code</Label>
              <CardholderLookup
                onSelect={setSelectedCardholder}
                selected={selectedCardholder}
              />
              {selectedCardholder && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold">{selectedCardholder.name}</span>
                    <span className="text-slate-600"> • Door Code: </span>
                    <span className="font-mono font-bold text-green-700">{selectedCardholder.pin}#</span>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button
                onClick={sendToPlanningCenter}
                disabled={!selectedCardholder?.pin || sendingToPCO || sentToPCO}
                variant="outline"
                className="border-blue-300 hover:bg-blue-50"
              >
                {sendingToPCO ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : sentToPCO ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                {sentToPCO ? 'Sent to Planning Center ✓' : 'Send to Planning Center'}
              </Button>

              <Button
                onClick={handleDeny}
                disabled={denying || approving}
                variant="outline"
                className="border-red-300 hover:bg-red-50 flex-1"
              >
                {denying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Deny
              </Button>

              <Button
                onClick={handleApprove}
                disabled={approving || denying}
                className="bg-green-600 hover:bg-green-700 flex-1"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}