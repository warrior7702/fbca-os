import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Calendar, MapPin, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ApprovalDetailModal({ approval, isOpen, onClose, onApprovalAction }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen && approval) {
            loadDetails();
        }
    }, [isOpen, approval]);

    const loadDetails = async () => {
        setLoading(true);
        try {
            console.log('🔍 Loading details for approval:', approval);
            const response = await base44.functions.invoke('getApprovalDetails', {
                request_id: approval.request_id,
                event_id: approval.event_id,
                resource_id: approval.resource_id
            });

            console.log('📥 Details response:', response.data);
            console.log('📋 Questions:', response.data.questions);
            console.log('💬 Answers object:', response.data.answers);
            console.log('💬 Answers keys:', Object.keys(response.data.answers || {}));
            
            setDetails(response.data);
        } catch (error) {
            console.error('Error loading approval details:', error);
            toast.error('Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await base44.functions.invoke('approveResourceRequest', {
                request_id: approval.request_id
            });
            toast.success('Approved successfully!');
            onApprovalAction();
            onClose();
        } catch (error) {
            console.error('Approval error:', error);
            toast.error('Failed to approve');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeny = async () => {
        setActionLoading(true);
        try {
            await base44.functions.invoke('denyResourceRequest', {
                request_id: approval.request_id
            });
            toast.success('Denied successfully!');
            onApprovalAction();
            onClose();
        } catch (error) {
            console.error('Deny error:', error);
            toast.error('Failed to deny');
        } finally {
            setActionLoading(false);
        }
    };

    if (!approval) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <FileText className="w-6 h-6 text-purple-600" />
                        Approval Request Details
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                ) : details ? (
                    <div className="space-y-6">
                        {/* Event Info */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                            <h3 className="font-semibold text-lg text-purple-900 mb-3">{details.event?.name || approval.event_name}</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-purple-600" />
                                    <span className="text-slate-700">
                                        {details.event?.starts_at ? format(new Date(details.event.starts_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-purple-600" />
                                    <span className="text-slate-700">{approval.resource_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-purple-600" />
                                    <span className="text-slate-700">{approval.approval_group_name}</span>
                                </div>
                            </div>
                            {details.event?.summary && (
                                <p className="mt-3 text-sm text-slate-600 italic">{details.event.summary}</p>
                            )}
                        </div>

                        {/* Questions & Answers */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-600" />
                                Request Details
                            </h4>
                            
                            {details.questions && details.questions.length > 0 ? (
                                <div className="space-y-3">
                                    {details.questions.map((question) => {
                                        const answer = details.answers?.[question.id];
                                        console.log(`🔎 Question ${question.id}:`, {
                                            question_text: question.question,
                                            answer_from_map: answer,
                                            question_id_type: typeof question.id,
                                            all_answer_keys: Object.keys(details.answers || {})
                                        });
                                        
                                        return (
                                            <div key={question.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <p className="font-medium text-slate-900 mb-1">{question.question}</p>
                                                {question.description && (
                                                    <p className="text-xs text-slate-500 mb-2">{question.description}</p>
                                                )}
                                                <div className="mt-2">
                                                    {answer ? (
                                                        <p className="text-slate-700 bg-white px-3 py-2 rounded border border-slate-200">
                                                            {answer}
                                                        </p>
                                                    ) : (
                                                        <p className="text-slate-400 italic text-sm">No answer provided</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No additional details provided</p>
                            )}
                        </div>

                        {/* Debug Info */}
                        {details.diag && (
                            <details className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
                                <summary className="cursor-pointer font-medium">Debug Info</summary>
                                <pre className="mt-2 overflow-auto">{JSON.stringify(details.diag, null, 2)}</pre>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={actionLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDeny}
                                disabled={actionLoading}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Deny
                            </Button>
                            <Button
                                onClick={handleApprove}
                                disabled={actionLoading}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Approve
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-slate-500 py-8">Failed to load details</p>
                )}
            </DialogContent>
        </Dialog>
    );
}