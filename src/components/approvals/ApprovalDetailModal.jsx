import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ApprovalDetailModal({ approval, onClose, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [approval.request_id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading approval details for request:', approval.request_id);
      console.log('   Resource ID:', approval.resource_id);
      console.log('   Event ID:', approval.event_id);
      
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        resource_id: approval.resource_id,
        event_id: approval.event_id
      });

      console.log('📦 Full response:', response);
      console.log('📦 Response data:', response.data);
      console.log('❓ Questions received:', response.data.questions);
      console.log('💬 Answers received:', response.data.answers);
      
      setQuestions(response.data.questions || []);
      setAnswers(response.data.answers || {});
      
      console.log('✅ Set', response.data.questions?.length || 0, 'questions');
      console.log('✅ Set', Object.keys(response.data.answers || {}).length, 'answers');
    } catch (error) {
      console.error('❌ Failed to load details:', error);
      console.error('❌ Error details:', error.response?.data);
      toast.error('Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Approved successfully!');
      onComplete();
    } catch (error) {
      console.error('Approval failed:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    setProcessing(true);
    try {
      await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Request denied');
      onComplete();
    } catch (error) {
      console.error('Denial failed:', error);
      toast.error('Failed to deny request');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{approval.event_name}</DialogTitle>
          <DialogDescription>
            Review resource request details and answers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-medium">
                {approval.event_starts_at
                  ? format(new Date(approval.event_starts_at), 'PPP p')
                  : 'No date set'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-500" />
              <span>{approval.resource_name}</span>
              {approval.quantity > 1 && (
                <Badge variant="outline">Qty: {approval.quantity}</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">
                Requested {format(new Date(approval.pco_created_at), 'PP')}
              </span>
            </div>

            <Badge className="bg-orange-100 text-orange-700">
              {approval.approval_group_name}
            </Badge>
          </div>

          <Separator />

          {/* Resource Questions & Answers */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : questions.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900">
                  Resource Questions ({questions.length})
                </h3>
              </div>

              {questions.map((question) => (
                <div key={question.id} className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <p className="font-medium text-slate-900">{question.question}</p>
                  {question.description && (
                    <p className="text-sm text-slate-600">{question.description}</p>
                  )}
                  <div className="pt-2">
                    {answers[question.id] ? (
                      <div className="flex items-start gap-2">
                        <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <p className="text-slate-700">{answers[question.id]}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No answer provided</p>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="text-xs text-slate-500 mt-2">
                Showing {Object.keys(answers).length} of {questions.length} answers
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No resource questions for this request</p>
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={processing}
            >
              Close
            </Button>
            
            <Button
              onClick={handleDeny}
              disabled={processing}
              variant="outline"
              className="text-red-600 hover:bg-red-50"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Deny
                </>
              )}
            </Button>

            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}