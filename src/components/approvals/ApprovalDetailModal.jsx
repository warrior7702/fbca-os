import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function ApprovalDetailModal({ approval, onClose, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [approval]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      console.log('📋 Loading approval details for:', approval.request_id);
      const response = await base44.functions.invoke('getApprovalDetailsV2', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });
      
      console.log('✅ Details loaded:', response.data);
      setDetails(response.data);
    } catch (error) {
      console.error('❌ Failed to load details:', error);
      toast.error('Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await base44.functions.invoke('approveResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Request approved successfully!');
      onComplete();
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
      await base44.functions.invoke('denyResourceRequest', {
        request_id: approval.request_id
      });
      toast.success('Request denied');
      onComplete();
    } catch (error) {
      console.error('Denial error:', error);
      toast.error('Failed to deny request');
    } finally {
      setDenying(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{approval.event_name}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/90">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {approval.event_starts_at
                        ? new Date(approval.event_starts_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Date TBD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {approval.event_starts_at
                        ? new Date(approval.event_starts_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : 'Time TBD'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : !details || !details.ok ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load approval details. Please try again.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {/* Resource Info */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Resource Request</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Resource</p>
                        <p className="font-medium text-slate-900">{approval.resource_name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Approval Group</p>
                        <p className="font-medium text-slate-900">{approval.approval_group_name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Quantity</p>
                        <p className="font-medium text-slate-900">{approval.quantity}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Requested</p>
                        <p className="font-medium text-slate-900">
                          {new Date(approval.pco_created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions & Answers */}
                {details.questions && details.questions.length > 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Resource Questions
                        {!details.booking_found && (
                          <Badge variant="outline" className="text-xs">
                            Not yet answered
                          </Badge>
                        )}
                      </h3>
                      <div className="space-y-4">
                        {details.questions.map((question) => (
                          <div key={question.id} className="border-l-2 border-orange-300 pl-4">
                            <p className="font-medium text-slate-900 mb-1">
                              {question.question}
                              {question.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            {question.description && (
                              <p className="text-sm text-slate-500 mb-2">{question.description}</p>
                            )}
                            <div className="bg-slate-50 rounded-lg p-3">
                              {details.answers && details.answers[question.id] ? (
                                <p className="text-slate-900">{details.answers[question.id]}</p>
                              ) : (
                                <p className="text-slate-400 italic">Not answered yet</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No resource questions for this request
                    </AlertDescription>
                  </Alert>
                )}

                {/* Event Details */}
                {details.event && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-slate-900 mb-3">Event Details</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-slate-500">Event Name</p>
                          <p className="font-medium text-slate-900">{details.event.name}</p>
                        </div>
                        {details.event.starts_at && (
                          <div>
                            <p className="text-slate-500">Time</p>
                            <p className="font-medium text-slate-900">
                              {new Date(details.event.starts_at).toLocaleString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                              {details.event.ends_at && (
                                <span> - {new Date(details.event.ends_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-slate-200 p-6 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                disabled={approving || denying}
              >
                Close
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDeny}
                  disabled={approving || denying || loading}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
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
                  disabled={approving || denying || loading}
                  className="bg-green-600 hover:bg-green-700"
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}