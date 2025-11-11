import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Key, 
  Lock,
  ExternalLink,
  Loader2,
  Unlock,
  ChevronDown,
  ChevronUp,
  Video,
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

export default function ScheduleEventDetailModal({ open, onOpenChange, event }) {
  const [loading, setLoading] = useState(false);
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [resourcesExpanded, setResourcesExpanded] = useState(true);

  if (!event) return null;

  // Check if this is a Microsoft meeting
  const isMicrosoftMeeting = event.source === 'microsoft';

  const startDate = parseISO(event.starts_at);
  const endDate = parseISO(event.ends_at);
  const duration = differenceInMinutes(endDate, startDate);

  // For Microsoft meetings
  const getResponseBadge = (status) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'tentative':
        return <Badge className="bg-yellow-100 text-yellow-700"><HelpCircle className="w-3 h-3 mr-1" />Tentative</Badge>;
      case 'organizer':
        return <Badge className="bg-purple-100 text-purple-700"><Sparkles className="w-3 h-3 mr-1" />Organizer</Badge>;
      default:
        return null;
    }
  };

  const handleJoinMeeting = () => {
    if (event.meetingLink?.url) {
      window.open(event.meetingLink.url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl pr-8 flex items-center gap-2">
            {isMicrosoftMeeting ? (
              <Video className="w-6 h-6 text-purple-600" />
            ) : (
              <CalendarIcon className="w-6 h-6 text-green-600" />
            )}
            {event.name}
          </DialogTitle>
          <DialogDescription>
            {isMicrosoftMeeting ? 'Microsoft 365 Meeting' : 'PCO Calendar Event with Door Access'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className={`flex items-start gap-4 p-4 rounded-lg ${
            isMicrosoftMeeting ? 'bg-purple-50' : 'bg-green-50'
          }`}>
            <CalendarIcon className={`w-5 h-5 mt-1 ${
              isMicrosoftMeeting ? 'text-purple-600' : 'text-green-600'
            }`} />
            <div className="flex-1">
              <p className="font-semibold text-slate-900 mb-1">
                {format(startDate, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-sm text-slate-600">
                {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                <span className="text-slate-400 ml-2">
                  ({duration} minutes)
                </span>
              </p>
              {isMicrosoftMeeting && event.responseStatus && (
                <div className="mt-2">
                  {getResponseBadge(event.responseStatus)}
                </div>
              )}
            </div>
          </div>

          {/* MICROSOFT MEETING SPECIFIC */}
          {isMicrosoftMeeting && (
            <>
              {/* Meeting Link */}
              {event.meetingLink && (
                <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
                  <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    {event.meetingLink.provider} Meeting
                  </p>
                  <Button
                    onClick={handleJoinMeeting}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Join {event.meetingLink.provider}
                  </Button>
                </div>
              )}

              {/* Location */}
              {event.location && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <span className="text-slate-700">{event.location}</span>
                </div>
              )}

              {/* Organizer */}
              {event.organizer && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Organizer</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                      {event.organizer.name?.[0]?.toUpperCase() || 'O'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{event.organizer.name}</p>
                      <p className="text-xs text-slate-500">{event.organizer.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {event.attendees && event.attendees.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-3">
                    Attendees ({event.attendees.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {event.attendees.map((attendee, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                            {attendee.name?.[0]?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{attendee.name}</p>
                            <p className="text-xs text-slate-500">{attendee.email}</p>
                          </div>
                        </div>
                        {attendee.status && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              attendee.status === 'accepted' ? 'bg-green-50 text-green-700' :
                              attendee.status === 'declined' ? 'bg-red-50 text-red-700' :
                              attendee.status === 'tentative' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-slate-50 text-slate-700'
                            }`}
                          >
                            {attendee.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* PCO EVENT SPECIFIC */}
          {!isMicrosoftMeeting && (
            <>
              {/* Access Time */}
              {event.access_time && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-green-600" />
                    <p className="font-semibold text-green-900">Building Access Time</p>
                  </div>
                  <p className="text-slate-700">{event.access_time}</p>
                </div>
              )}

              {/* Door Code */}
              {event.posted_door_code && (
                <div className={`
                  p-6 rounded-lg border-2
                  ${event.posted_door_code.toLowerCase() === 'unlock' 
                    ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300' 
                    : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                  }
                `}>
                  <div className="flex items-center gap-3 mb-3">
                    {event.posted_door_code.toLowerCase() === 'unlock' ? (
                      <Unlock className="w-6 h-6 text-orange-600" />
                    ) : (
                      <Key className="w-6 h-6 text-green-600" />
                    )}
                    <p className={`text-lg font-bold ${
                      event.posted_door_code.toLowerCase() === 'unlock' ? 'text-orange-900' : 'text-green-900'
                    }`}>
                      Building Access Code
                    </p>
                  </div>
                  <div className={`
                    text-4xl font-bold text-center py-4 px-6 rounded-lg
                    ${event.posted_door_code.toLowerCase() === 'unlock' 
                      ? 'bg-gradient-to-r from-orange-200 to-amber-200 text-orange-900' 
                      : 'bg-green-200 text-green-900 font-mono'
                    }
                  `}>
                    {event.posted_door_code.toLowerCase() === 'unlock' 
                      ? 'Unlock' 
                      : `${event.posted_door_code}#`
                    }
                  </div>
                </div>
              )}

              {/* Rooms */}
              {event.resources && event.resources.filter(r => r.kind === 'Room').length > 0 && (
                <div>
                  <button
                    onClick={() => setRoomsExpanded(!roomsExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors mb-3 border border-green-200"
                  >
                    <h3 className="font-semibold text-green-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Rooms ({event.resources.filter(r => r.kind === 'Room').length})
                    </h3>
                    {roomsExpanded ? (
                      <ChevronUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                  
                  {roomsExpanded && (
                    <div className="space-y-2">
                      {event.resources.filter(r => r.kind === 'Room').map(resource => (
                        <div key={resource.id} className="p-4 bg-white rounded-lg border border-green-200">
                          <p className="font-medium text-slate-900">{resource.name}</p>
                          {resource.category && resource.category !== 'Uncategorized' && (
                            <p className="text-xs text-green-600 mt-1">{resource.category}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Other Resources */}
              {event.resources && event.resources.filter(r => r.kind !== 'Room').length > 0 && (
                <div>
                  <button
                    onClick={() => setResourcesExpanded(!resourcesExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors mb-3 border border-blue-200"
                  >
                    <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Resources ({event.resources.filter(r => r.kind !== 'Room').length})
                    </h3>
                    {resourcesExpanded ? (
                      <ChevronUp className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                  
                  {resourcesExpanded && (
                    <div className="space-y-2">
                      {event.resources.filter(r => r.kind !== 'Room').map(resource => (
                        <div key={resource.id} className="p-4 bg-white rounded-lg border border-blue-200">
                          <p className="font-medium text-slate-900">{resource.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{resource.kind}</span>
                            {resource.category && resource.category !== 'Uncategorized' && (
                              <>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-blue-600">{resource.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action Button */}
          <Button
            onClick={() => {
              if (isMicrosoftMeeting) {
                window.open(event.webLink || event.meetingLink?.url, '_blank');
              } else {
                window.open(`https://calendar.planningcenteronline.com/events/${event.event_id}`, '_blank');
              }
            }}
            className={`w-full ${
              isMicrosoftMeeting ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {isMicrosoftMeeting ? 'Open in Outlook' : 'View in Planning Center'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}