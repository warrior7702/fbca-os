import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  Video, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow, isThisWeek, isPast, isFuture, addMinutes, differenceInMinutes } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function MyMeetings() {
  const [user, setUser] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userTimezone, setUserTimezone] = useState('America/Chicago');

  useEffect(() => {
    // Detect user's timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
    console.log('🌍 Detected timezone:', detectedTimezone);

    loadData(detectedTimezone);

    // Update current time every minute for countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async (timezone = userTimezone) => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser.microsoft_access_token) {
        toast.error('Please connect Microsoft in Settings');
        setLoading(false);
        return;
      }

      console.log('📅 Fetching calendar with timezone:', timezone);

      const response = await base44.functions.invoke('getMicrosoftCalendar', {
        timezone: timezone
      });
      
      if (response.data && response.data.events) {
        setMeetings(response.data.events);
        console.log(`✅ Loaded ${response.data.events.length} meetings`);
        console.log('🌍 Calendar timezone:', response.data.timezone);
        
        toast.success(`Loaded ${response.data.events.length} meetings`);
      } else {
        setMeetings([]);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
      toast.error('Failed to load meetings');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await loadData(userTimezone);
    setSyncing(false);
  };

  const handleJoinMeeting = (meeting) => {
    if (meeting.meetingLink?.url) {
      window.open(meeting.meetingLink.url, '_blank');
      toast.success(`Opening ${meeting.meetingLink.provider}...`);
    } else if (meeting.webLink) {
      window.open(meeting.webLink, '_blank');
      toast.success('Opening in Outlook...');
    }
  };

  // Parse dates - they're already in the correct timezone from the API
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    return parseISO(dateStr);
  };

  // Filter meetings
  const now = new Date();
  const todayMeetings = meetings.filter(m => {
    const start = parseDate(m.start);
    return start && isToday(start);
  });
  
  const upcomingMeetings = meetings.filter(m => {
    const start = parseDate(m.start);
    return start && isFuture(start) && !isToday(start);
  });
  
  const pastMeetings = meetings.filter(m => {
    const end = parseDate(m.end);
    return end && isPast(end);
  });

  // Find next meeting
  const nextMeeting = meetings
    .filter(m => {
      const start = parseDate(m.start);
      return start && isFuture(start);
    })
    .sort((a, b) => parseDate(a.start) - parseDate(b.start))[0];

  // Check if meeting is happening now
  const isMeetingNow = (meeting) => {
    const start = parseDate(meeting.start);
    const end = parseDate(meeting.end);
    if (!start || !end) return false;
    return now >= start && now <= end;
  };

  // Get meeting status
  const getMeetingStatus = (meeting) => {
    const start = parseDate(meeting.start);
    const end = parseDate(meeting.end);
    
    if (!start || !end) {
      return { status: 'unknown', color: 'text-slate-600', bg: 'bg-slate-50', icon: CalendarIcon };
    }
    
    if (now >= start && now <= end) {
      return { status: 'live', color: 'text-green-600', bg: 'bg-green-50', icon: Video };
    }
    
    const minutesUntil = differenceInMinutes(start, now);
    if (minutesUntil > 0 && minutesUntil <= 15) {
      return { status: 'soon', color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock };
    }
    
    if (isFuture(start)) {
      return { status: 'upcoming', color: 'text-blue-600', bg: 'bg-blue-50', icon: CalendarIcon };
    }
    
    return { status: 'past', color: 'text-slate-400', bg: 'bg-slate-50', icon: CalendarIcon };
  };

  // Get response status badge
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading meetings...</p>
          <p className="text-xs text-slate-400 mt-2">Timezone: {userTimezone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.microsoft_access_token && <ConnectionWarning />}

        <AppHeader
          icon={Video}
          title="My Meetings"
          description={
            <div className="flex items-center gap-3 flex-wrap">
              <span>{meetings.length} meeting{meetings.length !== 1 ? 's' : ''} • {todayMeetings.length} today</span>
              <Badge variant="outline" className="text-xs">
                <Globe className="w-3 h-3 mr-1" />
                {userTimezone}
              </Badge>
            </div>
          }
          iconColor="from-purple-500 to-pink-500"
          action={
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Calendar
                </>
              )}
            </Button>
          }
        />

        {/* Next Meeting Countdown */}
        {nextMeeting && (() => {
          const start = parseDate(nextMeeting.start);
          const end = parseDate(nextMeeting.end);
          if (!start || !end) return null;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-6 text-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-purple-100 text-sm mb-1">Next Meeting</p>
                  <h2 className="text-2xl font-bold mb-2">{nextMeeting.subject}</h2>
                  <div className="flex items-center gap-4 text-sm text-purple-100 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                    </span>
                    {isMeetingNow(nextMeeting) && (
                      <Badge className="bg-green-500 text-white animate-pulse">
                        🔴 Live Now
                      </Badge>
                    )}
                    {!isMeetingNow(nextMeeting) && (
                      <span>
                        in {differenceInMinutes(start, currentTime)} minutes
                      </span>
                    )}
                  </div>
                </div>
                {nextMeeting.meetingLink && (
                  <Button
                    onClick={() => handleJoinMeeting(nextMeeting)}
                    className="bg-white text-purple-600 hover:bg-purple-50"
                    size="lg"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Join {nextMeeting.meetingLink.provider}
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* Today's Meetings */}
        {todayMeetings.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Today's Schedule</h2>
            <div className="space-y-3">
              {todayMeetings.map((meeting) => {
                const status = getMeetingStatus(meeting);
                const StatusIcon = status.icon;
                const start = parseDate(meeting.start);
                const end = parseDate(meeting.end);
                
                if (!start || !end) return null;
                
                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    <Card className="border-none">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Time */}
                          <div className="text-center min-w-20">
                            <p className="text-2xl font-bold text-slate-900">
                              {format(start, 'h:mm')}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(start, 'a')}
                            </p>
                          </div>

                          {/* Status Indicator */}
                          <div className={`w-1 h-full rounded-full ${status.bg}`} />

                          {/* Meeting Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                  {meeting.subject}
                                </h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs px-2 py-1 rounded-full ${status.bg} ${status.color} flex items-center gap-1`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {status.status === 'live' ? 'Live Now' : 
                                     status.status === 'soon' ? 'Starting Soon' : 
                                     status.status === 'upcoming' ? 'Upcoming' : 'Ended'}
                                  </span>
                                  {getResponseBadge(meeting.responseStatus)}
                                  {meeting.meetingLink && (
                                    <Badge variant="outline" className="text-xs">
                                      {meeting.meetingLink.provider}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Meeting Details */}
                            <div className="space-y-1 text-sm text-slate-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                                  <span className="text-slate-400 ml-2">
                                    ({differenceInMinutes(end, start)} min)
                                  </span>
                                </span>
                              </div>

                              {meeting.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{meeting.location}</span>
                                </div>
                              )}

                              {meeting.attendees && meeting.attendees.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  <span>{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3">
                              {meeting.meetingLink && (
                                <Button
                                  onClick={() => handleJoinMeeting(meeting)}
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  <Video className="w-4 h-4 mr-1" />
                                  Join
                                </Button>
                              )}
                              <Button
                                onClick={() => setSelectedMeeting(meeting)}
                                variant="outline"
                                size="sm"
                              >
                                Details
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Upcoming</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingMeetings.slice(0, 6).map((meeting) => {
                const start = parseDate(meeting.start);
                if (!start) return null;
                
                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <Card className="border-none h-full">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              {isToday(start) ? 'Today' :
                               isTomorrow(start) ? 'Tomorrow' :
                               format(start, 'EEEE, MMM d')}
                            </p>
                            <h3 className="font-semibold text-slate-900 line-clamp-2">
                              {meeting.subject}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="w-4 h-4" />
                            {format(start, 'h:mm a')}
                          </div>

                          {meeting.meetingLink && (
                            <Badge variant="outline" className="text-xs">
                              {meeting.meetingLink.provider}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {meetings.length === 0 && (
          <div className="text-center py-20">
            <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Meetings Found</h3>
            <p className="text-slate-600">
              No upcoming meetings in your calendar
            </p>
          </div>
        )}
      </div>

      {/* Meeting Detail Modal */}
      <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">{selectedMeeting?.subject}</DialogTitle>
            <DialogDescription>
              Meeting details and information
            </DialogDescription>
          </DialogHeader>
          {selectedMeeting && (() => {
            const start = parseDate(selectedMeeting.start);
            const end = parseDate(selectedMeeting.end);
            
            if (!start || !end) return <p className="text-slate-500">Invalid meeting times</p>;
            
            return (
              <div className="space-y-6">
                {/* Time & Status */}
                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-purple-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 mb-1">
                      {format(start, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-slate-600">
                      {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                      <span className="text-slate-400 ml-2">
                        ({differenceInMinutes(end, start)} minutes)
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedMeeting.startTimeZone || userTimezone}
                    </p>
                    <div className="mt-2">
                      {getResponseBadge(selectedMeeting.responseStatus)}
                    </div>
                  </div>
                </div>

                {/* Location */}
                {selectedMeeting.location && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-slate-600" />
                    <span className="text-slate-700">{selectedMeeting.location}</span>
                  </div>
                )}

                {/* Meeting Link */}
                {selectedMeeting.meetingLink && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">
                      {selectedMeeting.meetingLink.provider} Meeting
                    </p>
                    <Button
                      onClick={() => handleJoinMeeting(selectedMeeting)}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Join {selectedMeeting.meetingLink.provider}
                    </Button>
                  </div>
                )}

                {/* Organizer */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Organizer</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                      {selectedMeeting.organizer?.name?.[0]?.toUpperCase() || 'O'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{selectedMeeting.organizer?.name}</p>
                      <p className="text-xs text-slate-500">{selectedMeeting.organizer?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Attendees */}
                {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      Attendees ({selectedMeeting.attendees.length})
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedMeeting.attendees.map((attendee, idx) => (
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

                {/* Body Preview */}
                {selectedMeeting.bodyPreview && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Description</p>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedMeeting.bodyPreview}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => window.open(selectedMeeting.webLink, '_blank')}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Outlook
                  </Button>
                  <Button
                    onClick={() => setSelectedMeeting(null)}
                    variant="outline"
                  >
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}