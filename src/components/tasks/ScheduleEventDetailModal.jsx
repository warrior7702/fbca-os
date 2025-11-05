
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar, Clock, MapPin, Key, ExternalLink, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { base44 } from "@/api/base44Client";

export default function ScheduleEventDetailModal({ open, onOpenChange, event }) {
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState([]);
  const [doorCodes, setDoorCodes] = useState([]);
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [resourcesExpanded, setResourcesExpanded] = useState(true);

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
      setDoorCodes(commentsResponse.data.door_codes || []);
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const startDate = parseISO(event.starts_at);
  const endDate = parseISO(event.ends_at);
  const latestDoorCode = doorCodes[doorCodes.length - 1];

  // Separate rooms from other resources
  const rooms = resources.filter(r => r.resource_kind === 'Room');
  const otherResources = resources.filter(r => r.resource_kind !== 'Room');

  // Find the "What time do you want access to begin and end?" answer
  const accessTimeAnswer = resources
    .flatMap(r => r.answers || [])
    .find(a => a.question?.toLowerCase().includes('what time do you want access to begin and end'));

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {event.name}
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
                <div className="flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-600" />
                    <span>
                      {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                    </span>
                  </div>
                  {accessTimeAnswer && (
                    <div className="flex items-center gap-2 text-sm">
                      <Lock className="w-4 h-4 text-green-600" />
                      <span>{accessTimeAnswer.answer}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Door Code */}
            {latestDoorCode && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-yellow-700" />
                      <span className="font-semibold text-yellow-900">Building Access Code</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-yellow-900 bg-yellow-200 px-4 py-2 rounded-lg">
                      {latestDoorCode}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rooms Section - Collapsible */}
            {rooms.length > 0 && (
              <div>
                <button
                  onClick={() => setRoomsExpanded(!roomsExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors mb-3"
                >
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Rooms ({rooms.length})
                  </h3>
                  {roomsExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}
                </button>
                
                {roomsExpanded && (
                  <div className="space-y-2">
                    {rooms.map((resource) => (
                      <Card key={resource.request_id} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{resource.resource_name}</p>
                              {resource.quantity && (
                                <p className="text-xs text-slate-500 mt-1">Quantity: {resource.quantity}</p>
                              )}
                            </div>
                            <Badge className={getApprovalStatusColor(resource.approval_status)}>
                              <span className="flex items-center gap-1">
                                {getApprovalStatusIcon(resource.approval_status)}
                                {resource.approval_status === 'A' && 'Approved'}
                                {resource.approval_status === 'P' && 'Pending'}
                                {resource.approval_status === 'R' && 'Rejected'}
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
                )}
              </div>
            )}

            {/* Other Resources Section - Collapsible */}
            {otherResources.length > 0 && (
              <div>
                <button
                  onClick={() => setResourcesExpanded(!resourcesExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors mb-3"
                >
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-green-600" />
                    Resources ({otherResources.length})
                  </h3>
                  {resourcesExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}
                </button>
                
                {resourcesExpanded && (
                  <div className="space-y-2">
                    {otherResources.map((resource) => (
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
                                {resource.approval_status === 'A' && 'Approved'}
                                {resource.approval_status === 'P' && 'Pending'}
                                {resource.approval_status === 'R' && 'Rejected'}
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
                )}
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
