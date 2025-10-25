import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Calendar, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ApprovalDetailModal({ approval, open, onClose, onApprove, onDeny }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [eventDetails, setEventDetails] = useState(null);

  useEffect(() => {
    if (open && approval) {
      loadDetails();
    }
  }, [open, approval]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      // Load resource questions and answers
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        resource_id: approval.resource_id,
        event_id: approval.event_id
      });
      
      setQuestions(response.data?.questions || []);
      setAnswers(response.data?.answers || {});
      setEventDetails(response.data?.event || null);
    } catch (error) {
      console.error('Error loading approval details:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAnswer = (question, answer) => {
    if (!answer) {
      return <span className="text-slate-400 italic">No answer provided</span>;
    }

    // Safe string coercion
    const answerStr = String(answer || '');

    if (question?.kind === 'dropdown' && question?.multiple_select) {
      // Multiple select - answer might be an array or comma-separated string
      const values = Array.isArray(answer) 
        ? answer 
        : answerStr.includes(',') 
          ? answerStr.split(',').map(v => v.trim()).filter(Boolean)
          : [answerStr];
      
      return (
        <div className="flex flex-wrap gap-1">
          {values.map((value, idx) => (
            <Badge key={idx} variant="secondary">{value}</Badge>
          ))}
        </div>
      );
    }

    if (question?.kind === 'paragraph') {
      return <p className="text-slate-700 whitespace-pre-wrap">{answerStr}</p>;
    }

    return <p className="text-slate-700">{answerStr}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {approval?.event_name || 'Event Details'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Details */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Event Details</h3>
              </div>
              
              {eventDetails ? (
                <>
                  {eventDetails.starts_at && (
                    <p className="text-sm">
                      <span className="font-medium">Start:</span>{' '}
                      {format(parseISO(eventDetails.starts_at), 'PPP p')}
                    </p>
                  )}
                  {eventDetails.ends_at && (
                    <p className="text-sm">
                      <span className="font-medium">End:</span>{' '}
                      {format(parseISO(eventDetails.ends_at), 'PPP p')}
                    </p>
                  )}
                  {eventDetails.summary && (
                    <p className="text-sm">
                      <span className="font-medium">Summary:</span>{' '}
                      {eventDetails.summary}
                    </p>
                  )}
                </>
              ) : approval?.event_starts_at ? (
                <>
                  <p className="text-sm">
                    <span className="font-medium">Start:</span>{' '}
                    {format(parseISO(approval.event_starts_at), 'PPP p')}
                  </p>
                  {approval?.event_ends_at && (
                    <p className="text-sm">
                      <span className="font-medium">End:</span>{' '}
                      {format(parseISO(approval.event_ends_at), 'PPP p')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">Event date not available</p>
              )}

              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm">
                  <span className="font-medium">Resource:</span>{' '}
                  <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                    {approval?.resource_name || 'Unknown'}
                  </Badge>
                </p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Quantity:</span> {approval?.quantity || 0}
                </p>
                {approval?.pco_created_at && (
                  <p className="text-xs text-slate-500 mt-1">
                    Requested: {format(parseISO(approval.pco_created_at), 'PPp')}
                  </p>
                )}
              </div>
            </div>

            {/* Resource Questions & Answers */}
            {questions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">Resource Questions</h3>
                </div>
                
                {questions.map((question) => (
                  <div key={question?.id || Math.random()} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-slate-900">{question?.question || 'Question'}</p>
                      {!question?.optional && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">Required</Badge>
                      )}
                    </div>
                    
                    {question?.description && (
                      <p className="text-xs text-slate-500 mb-2">{question.description}</p>
                    )}
                    
                    <div className="mt-2 pl-3 border-l-2 border-blue-200">
                      {renderAnswer(question, answers[question?.id])}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No additional questions for this resource.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onApprove(approval);
                  onClose();
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Request
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-red-600 hover:bg-red-50 border-red-300"
                onClick={() => {
                  onDeny(approval);
                  onClose();
                }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Deny Request
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}