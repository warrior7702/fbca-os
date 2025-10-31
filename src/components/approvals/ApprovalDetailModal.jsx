import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Calendar, Clock, User, CheckCircle, XCircle, Loader2, Key, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CardholderLookup from "./CardholderLookup";

export default function ApprovalDetailModal({ approval, open, onClose, onApprovalAction }) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCardholder, setSelectedCardholder] = useState(null);
  const [savingCode, setSavingCode] = useState(false);

  useEffect(() => {
    if (open && approval) {
      loadDetails();
      setSelectedCardholder(null);
    }
  }, [open, approval]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
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
        setError(response.data?.error || 'Failed to load details');
      }
    } catch (error) {
      console.error('❌ Failed to load details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCodeToPCO = async () => {
    if (!selectedCardholder) {
      toast.error('Please select a cardholder first');
      return;
    }

    setSavingCode(true);
    try {
      const note = `Door Code: ${selectedCardholder.pin}# (${selectedCardholder.name})`;
      
      const response = await base44.functions.invoke('writePCONote', {
        request_id: approval.request_id,
        note: note
      });

      if (response.data?.ok) {
        toast.success('Door code saved to PCO notes!');
      } else {
        toast.error(response.data?.error || 'Failed to save code');
      }
    } catch (error) {
      console.error('Failed to save code:', error);
      toast.error('Failed to save door code');
    } finally {
      setSavingCode(false);
    }
  };

  const handleApprove = async () => {
    try {
      await onApprovalAction(approval, 'approve');
      onClose();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleDeny = async () => {
    try {
      await onApprovalAction(approval, 'deny');
      onClose();
    } catch (error) {
      toast.error('Failed to deny request');
    }
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {approval.event_name}
          </DialogTitle>
        </DialogHeader>

        {/* Event Info */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">
                {format(new Date(approval.event_starts_at), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">
                {format(new Date(approval.event_starts_at), 'h:mm a')} - {format(new Date(approval.event_ends_at), 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">Approval Group: {approval.approval_group_name}</span>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Resource Info */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Requested Resource</h3>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{approval.resource_name}</p>
                  <p className="text-sm text-slate-600">Quantity: {approval.quantity || 1}</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700">
                  Pending Review
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Door Code Assignment */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Assign Door Code
          </h3>
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-4 space-y-3">
              <CardholderLookup onSelect={setSelectedCardholder} />
              
              {selectedCardholder && (
                <div className="p-3 bg-white rounded-lg border border-blue-300">
                  <p className="text-sm font-medium text-slate-900 mb-1">Selected:</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedCardholder.name}</p>
                      <p className="text-sm text-slate-600">Door Code: {selectedCardholder.pin}#</p>
                    </div>
                    <Button
                      onClick={handleSaveCodeToPCO}
                      disabled={savingCode}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {savingCode ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save to Notes
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600">Loading details...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Failed to load details</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Questions & Answers */}
        {!loading && !error && details && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Request Details</h3>
            
            {details.questions && details.questions.length > 0 ? (
              <div className="space-y-4">
                {details.questions.map((question) => {
                  const answer = details.answers?.[question.id];
                  
                  return (
                    <Card key={question.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <p className="font-medium text-slate-900 mb-1">
                          {question.question}
                          {question.optional && (
                            <span className="text-sm text-slate-500 ml-2">(optional)</span>
                          )}
                        </p>
                        
                        {question.description && (
                          <p className="text-sm text-slate-500 mb-2">{question.description}</p>
                        )}
                        
                        <div className="mt-2 p-3 bg-slate-50 rounded-md">
                          {answer ? (
                            <p className="text-slate-900">{answer}</p>
                          ) : (
                            <p className="text-slate-500 italic">No answer provided</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-slate-500 text-center py-4">
                    No additional details for this request
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleDeny}
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Deny
          </Button>
          <Button
            onClick={handleApprove}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}