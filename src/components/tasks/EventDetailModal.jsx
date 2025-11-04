import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Key, ExternalLink, Calendar, Users, Tag } from 'lucide-react';

export default function EventDetailModal({ open, onOpenChange, event }) {
  if (!event) return null;

  const handleOpenInPCO = () => {
    // PCO event URL format
    const pcoUrl = `https://calendar.planningcenteronline.com/events/${event.event_id}`;
    window.open(pcoUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{event.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Date & Time</p>
              <p className="text-sm text-slate-700">
                {format(parseISO(event.starts_at), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-sm text-slate-600">
                {format(parseISO(event.starts_at), 'h:mm a')} - {format(parseISO(event.ends_at), 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Resources/Locations */}
          {event.resources && event.resources.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-slate-900">Resources & Locations</h3>
              </div>
              <div className="space-y-2">
                {event.resources.map((resource, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Badge variant="outline" className="bg-white">
                      {resource.kind || 'Resource'}
                    </Badge>
                    <span className="text-sm font-medium">{resource.name}</span>
                    {resource.approval_status && (
                      <Badge className={
                        resource.approval_status === 'A' ? 'bg-green-100 text-green-700' :
                        resource.approval_status === 'P' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {resource.approval_status === 'A' ? 'Approved' :
                         resource.approval_status === 'P' ? 'Pending' : 'Rejected'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Door Codes */}
          {(event.posted_door_code || event.clickup_door_code) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-slate-900">Building Access Codes</h3>
              </div>
              <div className="space-y-2">
                {event.posted_door_code && (
                  <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                    <p className="text-xs text-purple-600 mb-1">PCO Posted Code</p>
                    <p className="text-3xl font-mono font-bold text-purple-700">
                      {event.posted_door_code}#
                    </p>
                    {event.posted_by && (
                      <p className="text-xs text-slate-500 mt-2">Posted by: {event.posted_by}</p>
                    )}
                  </div>
                )}
                {event.clickup_door_code && (
                  <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">ClickUp Task Code</p>
                    <p className="text-3xl font-mono font-bold text-green-700">
                      {event.clickup_door_code}#
                    </p>
                    {event.clickup_task_url && (
                      <a
                        href={event.clickup_task_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-flex items-center gap-1"
                      >
                        View ClickUp Task <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-slate-900">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {event.summary && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Summary</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.summary}</p>
            </div>
          )}

          {event.description && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleOpenInPCO} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Calendar className="w-4 h-4 mr-2" />
              View in Planning Center
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}