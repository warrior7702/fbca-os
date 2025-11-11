
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Video,
  Calendar as CalendarIcon, // Renamed Calendar to CalendarIcon to avoid conflict with "Calendar" component if exists
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
  Mic, // New icon for microphone
  Square, // New icon for stop recording
  Download, // New icon for download
  FileText // New icon for file text
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow, isFuture, differenceInMinutes } from "date-fns"; // Removed unused imports
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MyMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showMeetingDetail, setShowMeetingDetail] = useState(false); // New state for dialog
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState(''); // Renamed from userTimezone
  const [user, setUser] = useState(null); // NEW: Add user state

  // NEW: Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [processingNotes, setProcessingNotes] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState(null);
  const [savedNotes, setSavedNotes] = useState(null); // NEW: For displaying saved notes
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  useEffect(() => {
    // Detect user's timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
    console.log('🌍 Detected timezone:', detectedTimezone);

    loadData(); // Call loadData without argument as timezone is now state

    // Update current time every second for accurate countdown and recording time
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser); // NEW: Store user

      if (!currentUser || !currentUser.microsoft_access_token) {
        // If not connected, set meetings to empty and display warning
        setMeetings([]);
        setLoading(false);
        toast.error('Please connect Microsoft in Settings to see your meetings.');
        return;
      }

      console.log('📅 Fetching calendar with timezone:', timezone); // Use timezone from state

      const response = await base44.functions.invoke('getMicrosoftCalendar', {
        timezone: timezone // Pass timezone from state
      });

      if (response.data && response.data.events) {
        setMeetings(response.data.events);
        console.log(`✅ Loaded ${response.data.events.length} meetings`);
        console.log('🌍 Calendar timezone:', timezone); // Use timezone from state

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
    try {
      await loadData();
      toast.success("Calendar synced!");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  };

  const joinMeeting = (meeting) => {
    if (meeting.onlineMeeting?.joinUrl) {
      window.open(meeting.onlineMeeting.joinUrl, '_blank');
      toast.success(`Opening meeting link...`);
    } else if (meeting.meetingLink?.url) { // Fallback to meetingLink if onlineMeeting not available
      window.open(meeting.meetingLink.url, '_blank');
      toast.success(`Opening ${meeting.meetingLink.provider}...`);
    } else if (meeting.webLink) { // Fallback to webLink
      window.open(meeting.webLink, '_blank');
      toast.success('Opening in Outlook...');
    } else {
      toast.error('No join link available for this meeting.');
    }
  };

  // Parse dates - they're already in the correct timezone from the API
  const parseMeetingDate = (dateStr) => {
    if (!dateStr) return null;
    return parseISO(dateStr);
  };

  // NEW: Load saved notes when modal opens
  const loadSavedNotes = async (meetingId) => {
    if (!user) return; // Ensure user is loaded

    try {
      // Assuming 'base44.entities.MeetingNote' is available for database interaction
      const notes = await base44.entities.MeetingNote.filter({
        meeting_id: meetingId,
        user_email: user.email // Filter by current user's email
      });

      if (notes && notes.length > 0) {
        setSavedNotes(notes[0]); // Assuming one note per meeting per user
        setMeetingNotes(notes[0]); // Display the saved notes
        console.log('✅ Loaded saved notes for meeting:', meetingId);
      } else {
        setSavedNotes(null);
        setMeetingNotes(null);
      }
    } catch (error) {
      console.error('Error loading saved notes:', error);
      toast.error('Failed to load saved notes.');
    }
  };

  // NEW: Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop()); // Stop all tracks on stream
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      toast.success("Recording stopped");
    }
  };

  const generateNotes = async () => {
    if (!audioBlob || !selectedMeeting || !user) { // Added !user check
      toast.error("Missing required data (audio, meeting, or user)");
      return;
    }

    setProcessingNotes(true);
    try {
      console.log('🎙️ Uploading audio file...');

      // base44.integrations.Core.UploadFile does not take FormData directly,
      // it expects a File or Blob object.
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'meeting-recording.webm', { type: audioBlob.type })
      });

      console.log('✅ Audio uploaded:', uploadResponse.file_url);

      // Generate notes using AI
      console.log('🤖 Generating meeting notes...');
      const notesResponse = await base44.functions.invoke('generateMeetingNotes', {
        audio_url: uploadResponse.file_url,
        meeting_subject: selectedMeeting?.subject || 'Meeting',
        meeting_date: selectedMeeting?.start
      });

      console.log('✅ Notes generated:', notesResponse.data);

      // Save notes to database
      const savedNote = await base44.entities.MeetingNote.create({
        meeting_id: selectedMeeting.id,
        meeting_subject: selectedMeeting.subject,
        meeting_date: selectedMeeting.start,
        user_email: user.email, // Use user email for tracking
        audio_url: uploadResponse.file_url,
        summary: notesResponse.data.summary,
        action_items: notesResponse.data.action_items || [],
        transcript: notesResponse.data.transcript,
        recording_duration: recordingTime // Store recording duration
      });

      console.log('💾 Notes saved to database:', savedNote.id);

      setMeetingNotes(notesResponse.data);
      setSavedNotes(savedNote);
      toast.success("Meeting notes generated and saved!");

    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error("Failed to generate notes");
    } finally {
      setProcessingNotes(false);
    }
  };

  const downloadNotes = () => {
    if (!meetingNotes) return;

    // Use full meeting notes object for better formatting
    const notesContent = `Meeting Notes - ${selectedMeeting?.subject || 'Meeting'}

Date: ${selectedMeeting?.start ? format(parseISO(selectedMeeting.start), 'PPpp') : 'N/A'}
Timezone: ${timezone}

Summary:
${meetingNotes.summary || 'No summary available.'}

${meetingNotes.action_items && meetingNotes.action_items.length > 0 ? 'Action Items:\n' + meetingNotes.action_items.map(item => `- ${item}`).join('\n') : ''}

Transcript:
${meetingNotes.transcript || 'No transcript available.'}
`;

    const blob = new Blob([notesContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get meeting status
  const getMeetingStatus = (meeting) => {
    const start = parseMeetingDate(meeting.start);
    const end = parseMeetingDate(meeting.end);

    if (!start || !end) {
      return { status: 'unknown', label: 'Scheduled', bg: 'bg-slate-50', textColor: 'text-slate-600', icon: CalendarIcon };
    }

    if (currentTime >= start && currentTime <= end) {
      return { status: 'live', label: 'Live Now', bg: 'bg-green-50', textColor: 'text-green-600', icon: Video };
    }

    const minutesUntil = differenceInMinutes(start, currentTime);
    if (minutesUntil > 0 && minutesUntil <= 15) {
      return { status: 'soon', label: 'Starting Soon', bg: 'bg-orange-50', textColor: 'text-orange-600', icon: Clock };
    }

    if (isFuture(start)) {
      return { status: 'upcoming', label: 'Upcoming', bg: 'bg-blue-50', textColor: 'text-blue-600', icon: CalendarIcon };
    }

    return { status: 'past', label: 'Ended', bg: 'bg-slate-50', textColor: 'text-slate-400', icon: CalendarIcon };
  };

  // Get response status badge
  const getResponseBadge = (status) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'tentative':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300"><HelpCircle className="w-3 h-3 mr-1" />Tentative</Badge>;
      case 'organizer':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-300"><Sparkles className="w-3 h-3 mr-1" />Organizer</Badge>;
      default:
        return null;
    }
  };

  const getProviderBadge = (meeting) => {
    if (meeting.onlineMeeting?.joinUrl) {
      const url = meeting.onlineMeeting.joinUrl.toLowerCase();
      if (url.includes('teams.microsoft.com')) {
        return <Badge className="bg-purple-100 text-purple-700 border-purple-300">Teams</Badge>;
      } else if (url.includes('zoom.us')) {
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Zoom</Badge>;
      } else if (url.includes('meet.google.com')) {
        return <Badge className="bg-orange-100 text-orange-700 border-orange-300">Google Meet</Badge>;
      }
    }
    if (meeting.meetingLink?.provider) {
      return <Badge variant="outline">{meeting.meetingLink.provider}</Badge>;
    }
    return null; // Don't show "In Person" badge if no explicit online meeting provider
  };

  // Filter meetings
  const todaysMeetings = meetings.filter(m => {
    const start = parseMeetingDate(m.start);
    return start && isToday(start);
  }).sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start));

  const upcomingMeetings = meetings.filter(m => {
    const start = parseMeetingDate(m.start);
    // Include today's meetings that haven't started yet, and future meetings
    return start && isFuture(start);
  }).sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start));

  // Find next meeting (only from upcoming, excluding today's if they are handled separately)
  const nextMeeting = upcomingMeetings
    .filter(m => !isToday(parseMeetingDate(m.start))) // Exclude today's meetings if already handled in todaysMeetings
    .sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start))[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading meetings...</p>
          <p className="text-xs text-slate-400 mt-2">Timezone: {timezone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <ConnectionWarning /> {/* Render ConnectionWarning always */}

        <AppHeader
          icon={Video}
          title="My Meetings"
          description={
            <span className="flex items-center gap-2">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} • Timezone: {timezone}
            </span>
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
          const start = parseMeetingDate(nextMeeting.start);
          const end = parseMeetingDate(nextMeeting.end);
          const status = getMeetingStatus(nextMeeting);
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
                    {status.status === 'live' && (
                      <Badge className="bg-green-500 text-white animate-pulse">
                        🔴 Live Now
                      </Badge>
                    )}
                    {status.status === 'soon' && (
                      <Badge className="bg-orange-500 text-white">
                        Starts in {differenceInMinutes(start, currentTime)} minutes
                      </Badge>
                    )}
                  </div>
                </div>
                {nextMeeting.onlineMeeting?.joinUrl && (
                  <Button
                    onClick={() => joinMeeting(nextMeeting)}
                    className="bg-white text-purple-600 hover:bg-purple-50"
                    size="lg"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Join
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* Today's Meetings */}
        {todaysMeetings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                Today's Schedule
                <Badge variant="secondary">{todaysMeetings.length} meeting{todaysMeetings.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todaysMeetings.map((meeting) => {
                  const start = parseMeetingDate(meeting.start);
                  const end = parseMeetingDate(meeting.end);
                  const status = getMeetingStatus(meeting);
                  const StatusIcon = status.icon;

                  if (!start || !end) return null;

                  return (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedMeeting(meeting);
                        setShowMeetingDetail(true);
                        setAudioBlob(null); // Clear previous recording
                        setMeetingNotes(null); // Clear previous notes
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={`${status.bg} ${status.textColor}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            {getProviderBadge(meeting)}
                            {meeting.responseStatus && getResponseBadge(meeting.responseStatus)}
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">{meeting.subject || 'Untitled Meeting'}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {start ? format(start, 'h:mm a') : 'N/A'} - {end ? format(end, 'h:mm a') : 'N/A'}
                              <span className="text-slate-400 ml-2">
                                ({differenceInMinutes(end, start)} min)
                              </span>
                            </span>
                            {meeting.location?.displayName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {meeting.location.displayName}
                              </span>
                            )}
                            {meeting.attendees && meeting.attendees.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {meeting.onlineMeeting?.joinUrl && status.status !== 'past' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              joinMeeting(meeting);
                            }}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Join
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Upcoming Meetings</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingMeetings.slice(0, 6).map((meeting) => { // Only show up to 6 upcoming meetings
                const start = parseMeetingDate(meeting.start);
                if (!start) return null;

                return (
                  <motion.div
                    key={meeting.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setShowMeetingDetail(true);
                      setAudioBlob(null); // Clear previous recording
                      setMeetingNotes(null); // Clear previous notes
                    }}
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

                          {getProviderBadge(meeting)}
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
        {meetings.length === 0 && !loading && ( // Ensure it's not just loading
          <Card className="border-none shadow-none">
            <CardContent className="p-12 text-center">
              <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No meetings found</h3>
              <p className="text-slate-600">Your calendar is clear! Enjoy your day.</p>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-purple-600 hover:bg-purple-700 mt-4"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Syncing Calendar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meeting Detail Modal - UPDATED with Recording */}
      <Dialog open={showMeetingDetail} onOpenChange={(isOpen) => {
        setShowMeetingDetail(isOpen);
        if (!isOpen) {
          setSelectedMeeting(null);
          // Reset recording states when closing modal
          setIsRecording(false);
          setRecordingTime(0);
          setAudioBlob(null);
          setProcessingNotes(false);
          setMeetingNotes(null);
          setSavedNotes(null); // NEW: Clear savedNotes on close
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop(); // Stop any active recording
          }
          clearInterval(recordingIntervalRef.current);
        } else if (selectedMeeting) { // NEW: Load saved notes when opening dialog
          loadSavedNotes(selectedMeeting.id);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">
              {selectedMeeting?.subject || 'Meeting Details'}
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (() => {
            const start = parseMeetingDate(selectedMeeting.start);
            const end = parseMeetingDate(selectedMeeting.end);
            const status = getMeetingStatus(selectedMeeting);

            return (
              <div className="space-y-6">
                {/* Date & Time */}
                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-purple-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 mb-1">
                      {start ? format(start, 'EEEE, MMMM d, yyyy') : 'Date unavailable'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {start ? format(start, 'h:mm a') : 'N/A'} -
                      {end ? format(end, 'h:mm a') : 'N/A'}
                      <span className="text-slate-400 ml-2">
                        ({differenceInMinutes(end, start)} minutes)
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedMeeting.startTimeZone || timezone}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={`${status.bg} ${status.textColor}`}>{status.label}</Badge>
                      {getResponseBadge(selectedMeeting.responseStatus)}
                    </div>
                  </div>
                </div>

                {/* Location */}
                {selectedMeeting.location?.displayName && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-slate-600" />
                    <span className="text-slate-700">{selectedMeeting.location.displayName}</span>
                  </div>
                )}

                {/* NEW: AI Notetaker Section */}
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      AI Meeting Notetaker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show if notes already exist */}
                    {savedNotes && !audioBlob && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <strong>✅ Notes saved:</strong> {format(new Date(savedNotes.created_date), 'PPp')}
                        </p>
                      </div>
                    )}

                    {/* Recording Controls */}
                    {!savedNotes && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {!isRecording && !audioBlob && (
                          <Button
                            onClick={startRecording}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                        )}

                        {isRecording && (
                          <>
                            <Button
                              onClick={stopRecording}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Square className="w-4 h-4 mr-2" />
                              Stop Recording
                            </Button>
                            <Badge className="bg-red-500 text-white animate-pulse">
                              <div className="w-2 h-2 bg-white rounded-full mr-2" />
                              Recording: {formatRecordingTime(recordingTime)}
                            </Badge>
                          </>
                        )}

                        {audioBlob && !meetingNotes && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Recording saved ({formatRecordingTime(recordingTime)})
                            </Badge>
                            <Button
                              onClick={generateNotes}
                              disabled={processingNotes}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {processingNotes ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generate Notes
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meeting Notes Display */}
                    {meetingNotes && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Meeting Notes
                          </h3>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={downloadNotes}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>

                        {meetingNotes.summary && (
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-sm">Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{meetingNotes.summary}</p>
                            </CardContent>
                          </Card>
                        )}

                        {meetingNotes.action_items && meetingNotes.action_items.length > 0 && (
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-sm">Action Items</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc list-inside space-y-1">
                                {meetingNotes.action_items.map((item, idx) => (
                                  <li key={idx} className="text-sm text-slate-700">{item}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {meetingNotes.transcript && (
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-sm">Transcript</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-xs text-slate-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                                {meetingNotes.transcript}
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                {/* Organizer */}
                {selectedMeeting.organizer && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Organizer</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                        {selectedMeeting.organizer.name?.[0]?.toUpperCase() || 'O'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{selectedMeeting.organizer.name}</p>
                        <p className="text-xs text-slate-500">{selectedMeeting.organizer.email}</p>
                      </div>
                    </div>
                  </div>
                )}

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
                  {selectedMeeting.onlineMeeting?.joinUrl && (
                    <Button
                      onClick={() => joinMeeting(selectedMeeting)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Join Meeting
                    </Button>
                  )}
                  {selectedMeeting.webLink && (
                    <Button
                      onClick={() => window.open(selectedMeeting.webLink, '_blank')}
                      variant="outline"
                      className="flex-1"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Outlook
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
