
import React, { useState, useEffect, useRef } from "react";
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
  Mic,
  Square,
  Download,
  FileText,
  Search // Added Search icon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow, isFuture, differenceInMinutes, addMinutes } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function MyMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showMeetingDetail, setShowMeetingDetail] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState('');
  const [user, setUser] = useState(null);
  const [allMeetingNotes, setAllMeetingNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [processingNotes, setProcessingNotes] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState(null);
  const [savedNotes, setSavedNotes] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // NEW Booking states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState('select-person'); // 'select-person', 'booking-form', 'meeting-request'
  const [searchQuery, setSearchQuery] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [searchingStaff, setSearchingStaff] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [hasBookings, setHasBookings] = useState(false);
  const [bookingBusiness, setBookingBusiness] = useState(null);
  const [bookingServices, setBookingServices] = useState([]);
  const [loadingBookingInfo, setLoadingBookingInfo] = useState(false);
  const [bookingData, setBookingData] = useState({
    serviceId: '',
    date: '',
    time: '',
    duration: 30, // Default duration
    notes: ''
  });

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
    console.log('🌍 Detected timezone:', detectedTimezone);

    loadData();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load staff when modal opens
  useEffect(() => {
    if (showBookingModal && bookingStep === 'select-person') {
      loadAllStaff();
    }
  }, [showBookingModal, bookingStep]);

  const loadAllStaff = async () => {
    setSearchingStaff(true);
    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {});
      if (response.data.success && response.data.users) {
        setStaffResults(response.data.users);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setSearchingStaff(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser || !currentUser.microsoft_access_token) {
        setMeetings([]);
        setLoading(false);
        toast.error('Please connect Microsoft in Settings to see your meetings.');
        return;
      }

      console.log('📅 Fetching calendar with timezone:', timezone);

      const response = await base44.functions.invoke('getMicrosoftCalendar', {
        timezone: timezone
      });

      if (response.data && response.data.events) {
        setMeetings(response.data.events);
        console.log(`✅ Loaded ${response.data.events.length} meetings`);
        console.log('🌍 Calendar timezone:', timezone);

        toast.success(`Loaded ${response.data.events.length} meetings`);
      } else {
        setMeetings([]);
      }

      // Load all meeting notes
      await loadAllMeetingNotes(currentUser);
    } catch (error) {
      console.error('Error loading meetings:', error);
      toast.error('Failed to load meetings');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAllMeetingNotes = async (currentUser) => {
    if (!currentUser) return;
    
    setLoadingNotes(true);
    try {
      const notes = await base44.entities.MeetingNote.filter({
        user_email: currentUser.email
      });
      
      // Sort by meeting date, most recent first
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.meeting_date) - new Date(a.meeting_date)
      );
      
      setAllMeetingNotes(sortedNotes);
      console.log(`📝 Loaded ${sortedNotes.length} meeting notes`);
    } catch (error) {
      console.error('Error loading meeting notes:', error);
    } finally {
      setLoadingNotes(false);
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
    } else if (meeting.meetingLink?.url) {
      window.open(meeting.meetingLink.url, '_blank');
      toast.success(`Opening ${meeting.meetingLink.provider}...`);
    } else if (meeting.webLink) {
      window.open(meeting.webLink, '_blank');
      toast.success('Opening in Outlook...');
    } else {
      toast.error('No join link available for this meeting.');
    }
  };

  const parseMeetingDate = (dateStr) => {
    if (!dateStr) return null;
    return parseISO(dateStr);
  };

  const loadSavedNotes = async (meetingId) => {
    if (!user) return;

    try {
      const notes = await base44.entities.MeetingNote.filter({
        meeting_id: meetingId,
        user_email: user.email
      });

      if (notes && notes.length > 0) {
        setSavedNotes(notes[0]);
        setMeetingNotes(notes[0]);
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
        stream.getTracks().forEach(track => track.stop());
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
    if (!audioBlob || !selectedMeeting || !user) {
      toast.error("Missing required data (audio, meeting, or user)");
      return;
    }

    setProcessingNotes(true);
    try {
      console.log('🎙️ Uploading audio file...');

      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'meeting-recording.webm', { type: audioBlob.type })
      });

      console.log('✅ Audio uploaded:', uploadResponse.file_url);

      console.log('🤖 Generating meeting notes...');
      const notesResponse = await base44.functions.invoke('generateMeetingNotes', {
        audio_url: uploadResponse.file_url,
        meeting_subject: selectedMeeting?.subject || 'Meeting',
        meeting_date: selectedMeeting?.start
      });

      console.log('✅ Notes generated:', notesResponse.data);

      const savedNote = await base44.entities.MeetingNote.create({
        meeting_id: selectedMeeting.id,
        meeting_subject: selectedMeeting.subject,
        meeting_date: selectedMeeting.start,
        user_email: user.email,
        audio_url: uploadResponse.file_url,
        summary: notesResponse.data.summary,
        action_items: notesResponse.data.action_items || [],
        transcript: notesResponse.data.transcript,
        recording_duration: recordingTime
      });

      console.log('💾 Notes saved to database:', savedNote.id);

      setMeetingNotes(notesResponse.data);
      setSavedNotes(savedNote);
      await loadAllMeetingNotes(user); // Refresh notes list
      toast.success("Meeting notes generated and saved!");

    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error("Failed to generate notes");
    } finally {
      setProcessingNotes(false);
    }
  };

  const downloadNotes = (notesData) => {
    if (!notesData) return;

    const notesContent = `Meeting Notes - ${notesData.meeting_subject || 'Meeting'}

Date: ${notesData.meeting_date ? format(parseISO(notesData.meeting_date), 'PPpp') : 'N/A'}
Timezone: ${timezone}

Summary:
${notesData.summary || 'No summary available.'}

${notesData.action_items && notesData.action_items.length > 0 ? 'Action Items:\n' + notesData.action_items.map(item => `- ${item}`).join('\n') : ''}

Transcript:
${notesData.transcript || 'No transcript available.'}
`;

    const blob = new Blob([notesContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${format(new Date(notesData.meeting_date || new Date()), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // New Booking functions
  const searchStaff = async (query) => {
    if (!query || query.length < 2) {
      loadAllStaff();
      return;
    }

    setSearchingStaff(true);
    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {
        searchQuery: query
      });
      if (response.data.success && response.data.users) {
        setStaffResults(response.data.users);
      } else {
        setStaffResults([]);
      }
    } catch (error) {
      console.error('Error searching staff:', error);
      setStaffResults([]);
    } finally {
      setSearchingStaff(false);
    }
  };

  const handleSelectPerson = async (person) => {
    setSelectedPerson(person);
    setLoadingBookingInfo(true);

    try {
      // Check if person has Bookings setup
      const response = await base44.functions.invoke('checkUserBookingAvailability', {
        targetUserEmail: person.mail || person.userPrincipalName
      });

      if (response.data.hasBookings && response.data.bookingBusiness) {
        setHasBookings(true);
        setBookingBusiness(response.data.bookingBusiness);

        // Load services for this business
        const servicesResponse = await base44.functions.invoke('getBookingServices', { // Changed from getBookingStaff
          businessId: response.data.bookingBusiness.id
        });

        if (servicesResponse.data.success) {
          setBookingServices(servicesResponse.data.services || []);
        }

        setBookingStep('booking-form');
      } else {
        setHasBookings(false);
        setBookingStep('meeting-request');
      }
    } catch (error) {
      console.error('Error checking booking availability:', error);
      toast.error('Failed to check booking availability for this person.');
      setHasBookings(false);
      setBookingStep('meeting-request');
    } finally {
      setLoadingBookingInfo(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setLoadingBookingInfo(true); // Re-using loadingBookingInfo for form submission

    try {
      if (!selectedPerson || !bookingData.serviceId || !bookingData.date || !bookingData.time || !user || !bookingBusiness) {
        toast.error('Please fill all required fields and ensure user data is available.');
        setLoadingBookingInfo(false);
        return;
      }

      const startDateTimeString = `${bookingData.date}T${bookingData.time}:00`; // Ensure seconds are included for ISO string
      const startDateTime = new Date(startDateTimeString);
      const service = bookingServices.find(s => s.id === bookingData.serviceId);
      const durationInMinutes = service ? service.defaultDuration / 60 : bookingData.duration;
      const endDateTime = addMinutes(startDateTime, durationInMinutes);

      if (isNaN(startDateTime.getTime())) {
        toast.error('Invalid date or time entered.');
        setLoadingBookingInfo(false);
        return;
      }

      const response = await base44.functions.invoke('createMicrosoftBooking', {
        businessId: bookingBusiness.id,
        serviceId: bookingData.serviceId,
        // staffMemberId: staff members are auto-assigned by Bookings by default when not specified
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        customerName: user.full_name || user.email.split('@')[0], // Fallback for name
        customerEmail: user.email,
        notes: bookingData.notes
      });

      if (response.data.success) {
        toast.success('Booking created successfully!');
        resetBookingModal();
        await loadData(); // Reload meetings to show the new booking
      } else {
        toast.error(response.data.message || 'Failed to create booking.');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking: ' + error.message);
    } finally {
      setLoadingBookingInfo(false);
    }
  };

  const handleSendMeetingRequest = async (e) => {
    e.preventDefault();
    setLoadingBookingInfo(true); // Re-using loadingBookingInfo for form submission

    try {
      if (!selectedPerson || !bookingData.date || !bookingData.time || !user) {
        toast.error('Please fill all required fields');
        setLoadingBookingInfo(false);
        return;
      }

      const startDateTimeString = `${bookingData.date}T${bookingData.time}:00`;
      const startDateTime = new Date(startDateTimeString);
      const endDateTime = addMinutes(startDateTime, bookingData.duration);

      if (isNaN(startDateTime.getTime())) {
        toast.error('Invalid date or time entered.');
        setLoadingBookingInfo(false);
        return;
      }

      const response = await base44.functions.invoke('sendMeetingRequest', {
        attendeeEmail: selectedPerson.mail || selectedPerson.userPrincipalName,
        subject: `Meeting with ${selectedPerson.displayName}`,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        body: bookingData.notes || `Meeting request with ${selectedPerson.displayName} for ${format(startDateTime, 'Pp')}`
      });

      if (response.data.success) {
        toast.success('Meeting request sent!');
        resetBookingModal();
        await loadData();
      } else {
        toast.error('Failed to send meeting request');
      }
    } catch (error) {
      console.error('Error sending meeting request:', error);
      toast.error('Failed to send meeting request: ' + error.message);
    } finally {
      setLoadingBookingInfo(false);
    }
  };

  const resetBookingModal = () => {
    setShowBookingModal(false);
    setBookingStep('select-person');
    setSearchQuery('');
    setStaffResults([]);
    setSelectedPerson(null);
    setHasBookings(false);
    setBookingBusiness(null);
    setBookingServices([]);
    setLoadingBookingInfo(false);
    setBookingData({
      serviceId: '',
      date: '',
      time: '',
      duration: 30,
      notes: ''
    });
  };

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
    return null;
  };

  const todaysMeetings = meetings.filter(m => {
    const start = parseMeetingDate(m.start);
    return start && isToday(start);
  }).sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start));

  const upcomingMeetings = meetings.filter(m => {
    const start = parseMeetingDate(m.start);
    return start && isFuture(start);
  }).sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start));

  const nextMeeting = upcomingMeetings
    .filter(m => !isToday(parseMeetingDate(m.start)))
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
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {!user?.microsoft_access_token && <ConnectionWarning />}

        <AppHeader
          icon={Video}
          title="My Meetings"
          description={
            <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
              <span>{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-xs">Timezone: {timezone}</span>
            </span>
          }
          iconColor="from-purple-500 to-pink-500"
          action={
            <div className="flex gap-2">
              <Button
                onClick={() => setShowBookingModal(true)}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50"
              >
                <CalendarIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Book Meeting</span>
              </Button>
              <Button
                onClick={() => window.open('https://outlook.office.com/bookings/homepage', '_blank')}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50"
              >
                <ExternalLink className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit My Bookings</span>
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sync</span>
                  </>
                )}
              </Button>
            </div>
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
                      {start ? format(start, 'h:mm a') : 'N/A'} - {end ? format(end, 'h:mm a') : 'N/A'}
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
                        setAudioBlob(null);
                        setMeetingNotes(null);
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
              {upcomingMeetings.slice(0, 6).map((meeting) => {
                const start = parseMeetingDate(meeting.start);
                if (!start) return null;

                return (
                  <motion.div
                    key={meeting.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setShowMeetingDetail(true);
                      setAudioBlob(null);
                      setMeetingNotes(null);
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

        {/* AI Meeting Notes Section - NEW */}
        {allMeetingNotes.length > 0 && (
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                AI Meeting Notes
                <Badge variant="secondary">{allMeetingNotes.length} note{allMeetingNotes.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNotes ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                </div>
              ) : (
                <div className="space-y-4">
                  {allMeetingNotes.slice(0, 5).map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white rounded-lg border border-blue-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-blue-100 text-blue-700">
                              {note.meeting_subject || 'Untitled Meeting'}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {format(new Date(note.meeting_date), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {note.summary && (
                            <p className="text-sm text-slate-700 line-clamp-2 mb-2">
                              {note.summary}
                            </p>
                          )}
                          {note.action_items && note.action_items.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Action Items:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {note.action_items.slice(0, 3).map((item, idx) => (
                                  <li key={idx} className="text-xs text-slate-600 line-clamp-1">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadNotes(note)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                  {allMeetingNotes.length > 5 && (
                    <p className="text-sm text-slate-500 text-center mt-4">
                      And {allMeetingNotes.length - 5} more notes...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {meetings.length === 0 && (allMeetingNotes.length === 0 || !loadingNotes) && !loading && (
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

      {/* Meeting Detail Modal */}
      <Dialog open={showMeetingDetail} onOpenChange={(isOpen) => {
        setShowMeetingDetail(isOpen);
        if (!isOpen) {
          setSelectedMeeting(null);
          setIsRecording(false);
          setRecordingTime(0);
          setAudioBlob(null);
          setProcessingNotes(false);
          setMeetingNotes(null);
          setSavedNotes(null);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          clearInterval(recordingIntervalRef.current);
        } else if (selectedMeeting) {
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

                {/* AI Notetaker Section */}
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
                          </div >
                        )}
                      </div >
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
                            onClick={() => downloadNotes(meetingNotes)}
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

      {/* NEW: Booking Modal with Person Search */}
      <Dialog open={showBookingModal} onOpenChange={(isOpen) => {
        if (!isOpen) resetBookingModal();
        else setShowBookingModal(true);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book a Meeting</DialogTitle>
          </DialogHeader>

          {bookingStep === 'select-person' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search for a coworker..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchStaff(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>

              {searchingStaff && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
                </div>
              )}

              {staffResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {staffResults.map((person) => (
                    <div
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className="p-3 border border-slate-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                          {person.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{person.displayName}</p>
                          <p className="text-xs text-slate-500">{person.mail || person.userPrincipalName}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loadingBookingInfo && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Checking availability...</p>
                </div>
              )}
            </div>
          )}

          {bookingStep === 'booking-form' && selectedPerson && (
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm">
                  <strong>Booking with:</strong> {selectedPerson.displayName}
                </p>
                {bookingBusiness && (
                  <p className="text-xs text-slate-600 mt-1">
                    Business: {bookingBusiness.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Service</label>
                <Select
                  value={bookingData.serviceId}
                  onValueChange={(value) => setBookingData({...bookingData, serviceId: value})}
                  required
                  disabled={bookingServices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingServices.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.displayName} ({service.defaultDuration / 60} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={bookingData.date}
                    onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={bookingData.time}
                    onChange={(e) => setBookingData({...bookingData, time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({...bookingData, notes: e.target.value})}
                  placeholder="Add any notes..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetBookingModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loadingBookingInfo || !bookingData.serviceId || !bookingData.date || !bookingData.time} className="bg-purple-600 hover:bg-purple-700">
                  {loadingBookingInfo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Booking'
                  )}
                </Button>
              </div>
            </form>
          )}

          {bookingStep === 'meeting-request' && selectedPerson && (
            <form onSubmit={handleSendMeetingRequest} className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm">
                  <strong>Meeting with:</strong> {selectedPerson.displayName}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  This person doesn't have Bookings set up. Sending a regular meeting request instead.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={bookingData.date}
                    onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={bookingData.time}
                    onChange={(e) => setBookingData({...bookingData, time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <Input
                  type="number"
                  value={bookingData.duration}
                  onChange={(e) => setBookingData({...bookingData, duration: parseInt(e.target.value, 10)})}
                  min="15"
                  step="15"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({...bookingData, notes: e.target.value})}
                  placeholder="Add meeting details..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetBookingModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loadingBookingInfo || !bookingData.date || !bookingData.time} className="bg-blue-600 hover:bg-blue-700">
                  {loadingBookingInfo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Meeting Request'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
