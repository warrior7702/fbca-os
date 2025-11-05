import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar, Clock, MapPin, Key, ExternalLink, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ScheduleEventDetailModal({ open, onOpenChange, event }) {
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState([]);
  const [doorCodes, setDoorCodes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (open && event) {
      loadEventDetails();
    }
  }, [open, event]);

  const loadEventDetails = async () => {
    setLoading(true);
    try {
      // Fetch resources
      const resourcesResponse = await base44.functions.invoke('getPCOEventResources', {
        event_id: event.event_id
      });
      setResources(resourcesResponse.data.resource_requests || []);

      // Fetch comments/door codes
      const commentsResponse = await base44.functions.invoke('getPCOEventComments', {
        event_id: event.event_id
      });
      
      console.log('🔑 Door codes from PCO:', commentsResponse.data.door_codes);
      setDoorCodes(commentsResponse.data.door_codes || []);
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const commentsResponse = await base44.functions.invoke('getPCOEventComments', {
        event_id: event.event_id
      });
      
      console.log('🔄 Refreshed door codes:', commentsResponse.data.door_codes);
      setDoorCodes(commentsResponse.data.door_codes || []);
      
      if (commentsResponse.data.door_codes?.length > 0) {
        toast.success('Door codes refreshed!');
      } else {
        toast.info('No door codes found');
      }
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh door codes');
    } finally {
      setRefreshing(false);
    }
  };

  if (!event) return null;

  const startDate = parseISO(event.starts_at);
  const endDate = parseISO(event.ends_at);
  const latestDoorCode = doorCodes[doorCodes.length - 1]; // Get most recent door code

  const getApprovalStatusColor = (status) => {
    switch (status) {
      case 'A': return 'bg-green-100 text-green-700';
      case 'P': return 'bg-yellow-100 text-yellow-700';
      case 'R': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getApprovalStatusIcon = (status) => {
    switch (status) {
      case 'A': return <CheckCircle className="w-4 h-4" />;
      case 'P': return <AlertCircle className="w-4 h-4" />;
      case 'R': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getApprovalStatusText = (status) => {
    switch (status) {
      case 'A': return 'Approved';
      case 'P': return 'Pending';
      case 'R': return 'Rejected';
      default: return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            <span>{event.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-500 hover:text-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Info */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="font-medium">
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span>
                    {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Door Code - Prominent Display */}
            {latestDoorCode && (
              <Card className="border-2 border-yellow-400 bg-yellow-50 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="w-6 h-6 text-yellow-700" />
                      <span className="font-bold text-lg text-yellow-900">Building Access Code</span>
                    </div>
                    <div className="text-5xl font-mono font-bold text-yellow-900 bg-yellow-200 px-8 py-4 rounded-xl shadow-inner">
                      {latestDoorCode}
                    </div>
                    <p className="text-xs text-yellow-700 mt-3">
                      {doorCodes.length > 1 ? `Most recent of ${doorCodes.length} codes` : 'Posted to Planning Center'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Door Codes (if multiple) */}
            {doorCodes.length > 1 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">
                    All Door Codes ({doorCodes.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {doorCodes.map((code, idx) => (
                      <Badge key={idx} className="bg-yellow-200 text-yellow-900 font-mono text-sm">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Resources ({resources.length})
                </h3>
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <Card key={resource.request_id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{resource.resource_name}</p>
                            <p className="text-sm text-slate-500">{resource.resource_kind}</p>
                            {resource.quantity && (
                              <p className="text-xs text-slate-500 mt-1">Quantity: {resource.quantity}</p>
                            )}
                          </div>
                          <Badge className={getApprovalStatusColor(resource.approval_status)}>
                            <span className="flex items-center gap-1">
                              {getApprovalStatusIcon(resource.approval_status)}
                              {getApprovalStatusText(resource.approval_status)}
                            </span>
                          </Badge>
                        </div>
                        
                        {/* Resource Answers */}
                        {resource.answers && resource.answers.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Details:</p>
                            <div className="space-y-1">
                              {resource.answers.map((answer, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="text-slate-500">{answer.question}:</span>{' '}
                                  <span className="text-slate-700 font-medium">{answer.answer}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Event Description */}
            {event.summary && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{event.summary}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`https://calendar.planningcenteronline.com/events/${event.event_id}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Planning Center
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}