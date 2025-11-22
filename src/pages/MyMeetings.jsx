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
  Search,
  Trash2,
  User, // Added for ad-hoc attendees
  X // Added for ad-hoc attendees
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow, isFuture, isYesterday, differenceInMinutes, addMinutes } from "date-fns";
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
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EnhancedMeetingNotes from "../components/meetings/EnhancedMeetingNotes";
import DetailedMeetingNotesModal from "../components/meetings/DetailedMeetingNotesModal";
import QuickActions from "../components/meetings/QuickActions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export default function MyMeetings() {
  const navigate = useNavigate();

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
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [activeTab, setActiveTab] = useState('meetings');
  const [notesSearchQuery, setNotesSearchQuery] = useState('');

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
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Booking states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState('select-person');
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
    duration: 30,
    notes: ''
  });

  // Add staff search state
  const [staffForAssignment, setStaffForAssignment] = useState([]);
  // New state for viewing detailed notes
  const [viewingNoteDetail, setViewingNoteDetail] = useState(null);

  // Ad-hoc recording states
  const [showAdHocRecording, setShowAdHocRecording] = useState(false);
  const [adHocMeetingTitle, setAdHocMeetingTitle] = useState('');
  const [adHocAttendees, setAdHocAttendees] = useState([]);
  const [adHocSearchQuery, setAdHocSearchQuery] = useState('');
  const [adHocSearchResults, setAdHocSearchResults] = useState([]);
  const [currentMeetings, setCurrentMeetings] = useState([]);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null);

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

      // Load bookings (NEW)
      await loadMyBookings();
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

  const loadMyBookings = async () => {
    setLoadingBookings(true);
    try {
      const response = await base44.functions.invoke('getMyBookings');
      if (response.data.success) {
        setMyBookings(response.data.bookings || []);
        console.log(`📅 Loaded ${response.data.bookings?.length || 0} bookings`);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast.error('Failed to load your bookings.');
    } finally {
      setLoadingBookings(false);
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
      console.log('🎙️ Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      console.log('📼 MediaRecorder created');

      // Audio level visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      console.log('🎚️ Audio level meter initialized');

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);

          if (mediaRecorderRef.current?.state === 'recording') {
            requestAnimationFrame(updateLevel);
          } else {
            setAudioLevel(0);
          }
        }
      };
      updateLevel();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📊 Audio chunk received:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped, creating blob from', audioChunksRef.current.length, 'chunks');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('✅ Audio blob created:', audioBlob.size, 'bytes');
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          analyserRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      console.log('▶️ Recording started');

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Recording started - speak into your microphone!");
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      toast.error("Failed to start recording: " + error.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      clearInterval(recordingIntervalRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      toast.success("Recording stopped");
    }
  };

  const generateNotes = async () => {
    console.log('🔍 Generate Notes clicked');
    console.log('audioBlob:', audioBlob);
    console.log('selectedMeeting:', selectedMeeting);
    console.log('user:', user);

    if (!audioBlob || !selectedMeeting || !user) {
      console.error('❌ Missing required data:', {
        hasAudioBlob: !!audioBlob,
        hasSelectedMeeting: !!selectedMeeting,
        hasUser: !!user
      });
      toast.error("Missing required data (audio, meeting, or user)");
      return;
    }

    setProcessingNotes(true);
    const processingToast = toast.loading("Starting AI processing...");

    try {
      console.log('🎙️ Step 1: Uploading audio file...');
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      console.log('Audio blob type:', audioBlob.type);

      toast.loading("Uploading audio...", { id: processingToast });

      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'meeting-recording.mp3', { type: 'audio/mpeg' })
      });

      console.log('✅ Audio uploaded successfully');
      console.log('File URL:', uploadResponse.file_url);
      toast.loading("Audio uploaded! Processing with AI... (this may take 30-60 seconds)", { id: processingToast });

      console.log('🤖 Step 2: Generating meeting notes with AI...');

      // Prepare attendees data
      const attendeesData = selectedMeeting.attendees?.map(a => ({
        name: a.name,
        email: a.email
      })) || [];

      console.log('Calling transcribeMeetingAudio with:', {
        audio_url: uploadResponse.file_url,
        meeting_subject: selectedMeeting?.subject || 'Meeting',
        meeting_date: selectedMeeting?.start,
        attendees: attendeesData
      });

      // Set a longer timeout for AI processing
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI processing timed out after 2 minutes. Please try again or with a shorter recording.')), 120000)
      );

      const notesPromise = base44.functions.invoke('transcribeMeetingAudio', {
        audio_url: uploadResponse.file_url,
        meeting_subject: selectedMeeting?.subject || 'Meeting',
        meeting_date: selectedMeeting?.start,
        attendees: attendeesData
      });

      console.log('⏳ Waiting for AI response...');
      const notesResponse = await Promise.race([notesPromise, timeoutPromise]);

      console.log('✅ AI Response received:', notesResponse);

      if (!notesResponse.data) {
        console.error('❌ No data in response');
        throw new Error('No data returned from transcribeMeetingAudio');
      }

      if (notesResponse.data.error) {
        console.error('❌ Error in response:', notesResponse.data.error);
        throw new Error(notesResponse.data.error);
      }

      toast.loading("Saving notes...", { id: processingToast });

      console.log('💾 Step 3: Saving notes to database...');
      const savedNote = await base44.entities.MeetingNote.create({
        meeting_id: selectedMeeting.id,
        meeting_subject: selectedMeeting.subject,
        meeting_date: selectedMeeting.start,
        user_email: user.email,
        audio_url: uploadResponse.file_url,
        summary: notesResponse.data.summary || '',
        key_points: notesResponse.data.key_points || [],
        outline: notesResponse.data.outline || [],
        action_items: notesResponse.data.action_items || [],
        speakers: notesResponse.data.speakers || [],
        transcript: notesResponse.data.transcript || '',
        transcript_segments: notesResponse.data.transcript_segments || [],
        recording_duration: recordingTime
      });

      console.log('💾 Notes saved to database with ID:', savedNote.id);

      setMeetingNotes(notesResponse.data);
      setSavedNotes(savedNote);
      await loadAllMeetingNotes(user);

      toast.success("Meeting notes generated and saved!", { id: processingToast });
      console.log('✅ Switching to notes tab');
      setActiveTab('notes');

    } catch (error) {
      console.error("❌ Error generating notes:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      toast.error(`Failed: ${error.message}`, { id: processingToast });
    } finally {
      setProcessingNotes(false);
      console.log('🏁 Generate notes process complete');
    }
  };

  // Staff search for assignment
  const handleSearchStaffForAssignment = async (query) => {
    if (!query || query.length < 2) {
      const response = await base44.functions.invoke('getMicrosoftUsers', {});
      if (response.data.success && response.data.users) {
        setStaffForAssignment(response.data.users);
      }
      return;
    }

    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {
        searchQuery: query
      });
      if (response.data.success && response.data.users) {
        setStaffForAssignment(response.data.users);
      }
    } catch (error) {
      console.error('Error searching staff:', error);
      setStaffForAssignment([]);
    }
  };

  const handleAssignActionItem = async (actionItemIndex, person) => {
    if (!savedNotes) return;

    try {
      const updatedActionItems = [...savedNotes.action_items];
      // Ensure the action item itself is an object, or convert it
      if (typeof updatedActionItems[actionItemIndex] === 'string') {
        updatedActionItems[actionItemIndex] = {
          item: updatedActionItems[actionItemIndex],
          assigned_to: person.displayName,
          assigned_email: person.mail || person.userPrincipalName
        };
      } else {
        updatedActionItems[actionItemIndex] = {
          ...updatedActionItems[actionItemIndex],
          assigned_to: person.displayName,
          assigned_email: person.mail || person.userPrincipalName
        };
      }


      await base44.entities.MeetingNote.update(savedNotes.id, {
        action_items: updatedActionItems
      });

      setSavedNotes({
        ...savedNotes,
        action_items: updatedActionItems
      });

      // Also update the currently displayed meetingNotes if they are the same instance
      setMeetingNotes(prevMeetingNotes => {
        if (!prevMeetingNotes) return null;
        const newActionItems = [...prevMeetingNotes.action_items];
        if (typeof newActionItems[actionItemIndex] === 'string') {
          newActionItems[actionItemIndex] = {
            item: newActionItems[actionItemIndex],
            assigned_to: person.displayName,
            assigned_email: person.mail || person.userPrincipalName
          };
        } else {
          newActionItems[actionItemIndex] = {
            ...newActionItems[actionItemIndex],
            assigned_to: person.displayName,
            assigned_email: person.mail || person.userPrincipalName
          };
        }
        return {
          ...prevMeetingNotes,
          action_items: newActionItems
        };
      });

      await loadAllMeetingNotes(user);

      toast.success(`Assigned to ${person.displayName}`);
    } catch (error) {
      console.error('Error assigning action item:', error);
      toast.error('Failed to assign action item');
    }
  };

  const handleUpdateSegmentSpeaker = async (noteId, segmentIndex, person) => {
    try {
      const note = allMeetingNotes.find(n => n.id === noteId);
      if (!note) return;

      const updatedSegments = [...(note.transcript_segments || [])];
      updatedSegments[segmentIndex] = {
        ...updatedSegments[segmentIndex],
        speaker_name: person ? person.displayName : '',
        speaker_email: person ? (person.mail || person.userPrincipalName) : ''
      };

      await base44.entities.MeetingNote.update(noteId, {
        transcript_segments: updatedSegments
      });

      await loadAllMeetingNotes(user);

      // Update the viewing note if it's currently open
      if (viewingNoteDetail?.id === noteId) {
        setViewingNoteDetail({
          ...viewingNoteDetail,
          transcript_segments: updatedSegments
        });
      }

      toast.success(person ? `Speaker assigned` : 'Speaker removed');
    } catch (error) {
      console.error('Error updating speaker:', error);
      toast.error('Failed to update speaker');
    }
  };

  const downloadNotes = (notesData) => {
    if (!notesData) return;

    const notesContent = `Meeting Notes - ${notesData.meeting_subject || 'Meeting'}

Date: ${notesData.meeting_date ? format(parseISO(notesData.meeting_date), 'PPpp') : 'N/A'}
Timezone: ${timezone}

Summary:
${notesData.summary || 'No summary available.'}

${notesData.key_points && notesData.key_points.length > 0 ? '\nKey Points:\n' + notesData.key_points.map(item => `- ${item}`).join('\n') : ''}

${notesData.outline && notesData.outline.length > 0 ? '\nOutline:\n' + notesData.outline.map(item => `- ${item}`).join('\n') : ''}

${notesData.action_items && notesData.action_items.length > 0 ? '\nAction Items:\n' + notesData.action_items.map(item => `- ${typeof item === 'string' ? item : item.item + (item.assigned_to ? ` (Assigned to: ${item.assigned_to})` : '')}`).join('\n') : ''}

${notesData.speakers && notesData.speakers.length > 0 ? '\nSpeakers:\n' + notesData.speakers.map(s => `- ${s.name}: ${s.email || 'N/A'}`).join('\n') : ''}

${notesData.transcript ? '\nTranscript:\n' + notesData.transcript : ''}
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

  // Booking functions
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
      // Get person's booking options
      const response = await base44.functions.invoke('getUserBookingOptions', {
        userEmail: person.mail || person.userPrincipalName
      });

      if (response.data.success && response.data.options && response.data.options.length > 0) {
        setBookingServices(response.data.options);
        setBookingStep('booking-form');
      } else {
        toast.info(`Unable to load booking options for ${person.displayName}`);
        resetBookingModal();
      }
    } catch (error) {
      console.error('Error loading booking options:', error);
      toast.error('Failed to load booking options');
      resetBookingModal();
    } finally {
      setLoadingBookingInfo(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setLoadingBookingInfo(true);

    try {
      if (!selectedPerson || !bookingData.serviceId || !bookingData.date || !bookingData.time || !user) {
        toast.error('Please fill all required fields');
        setLoadingBookingInfo(false);
        return;
      }

      const startDateTimeString = `${bookingData.date}T${bookingData.time}:00`;
      const startDateTime = new Date(startDateTimeString);
      const service = bookingServices.find(s => s.id === bookingData.serviceId);
      const durationInMinutes = service ? service.duration : bookingData.duration;
      const endDateTime = addMinutes(startDateTime, durationInMinutes);

      if (isNaN(startDateTime.getTime())) {
        toast.error('Invalid date or time entered.');
        setLoadingBookingInfo(false);
        return;
      }

      const response = await base44.functions.invoke('bookPersonalMeeting', {
        attendeeEmail: selectedPerson.mail || selectedPerson.userPrincipalName,
        attendeeName: selectedPerson.displayName,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        subject: service.name,
        notes: bookingData.notes
      });

      if (response.data.success) {
        toast.success('Meeting booked successfully!');
        resetBookingModal();
        await loadData();
      } else {
        toast.error(response.data.message || 'Failed to book meeting.');
      }
    } catch (error) {
      console.error('Error booking meeting:', error);
      toast.error('Failed to book meeting: ' + error.message);
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

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  const groupedNotes = allMeetingNotes.reduce((groups, note) => {
    const dateLabel = getDateLabel(note.meeting_date);
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(note);
    return groups;
  }, {});

  const filteredGroupedNotes = Object.entries(groupedNotes).reduce((acc, [dateLabel, dateNotes]) => {
    const filtered = dateNotes.filter(note => {
      const searchLower = notesSearchQuery.toLowerCase();
      const actionItemsText = note.action_items?.map(item => typeof item === 'string' ? item : item.item).join(' ').toLowerCase();
      return (
        note.meeting_subject?.toLowerCase().includes(searchLower) ||
        note.summary?.toLowerCase().includes(searchLower) ||
        note.transcript?.toLowerCase().includes(searchLower) ||
        actionItemsText?.includes(searchLower) ||
        note.key_points?.some(item => item.toLowerCase().includes(searchLower)) ||
        note.outline?.some(item => item.toLowerCase().includes(searchLower))
      );
    });
    if (filtered.length > 0) {
      acc[dateLabel] = filtered;
    }
    return acc;
  }, {});

  const highlightKeywords = (text) => {
    if (!text) return '';
    const keywords = ['parking', 'security', 'staff', 'event', 'discussed', 'decided'];
    let highlighted = text;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-blue-600 font-medium">$1</span>');
    });
    return highlighted;
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

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this meeting note?')) return;

    try {
      await base44.entities.MeetingNote.delete(noteId);
      await loadAllMeetingNotes(user);
      toast.success('Meeting note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleDeleteAllNotes = async () => {
    if (!confirm(`Are you sure you want to delete all ${allMeetingNotes.length} meeting notes? This cannot be undone.`)) return;

    try {
      await Promise.all(allMeetingNotes.map(note => base44.entities.MeetingNote.delete(note.id)));
      await loadAllMeetingNotes(user);
      toast.success('All meeting notes deleted');
    } catch (error) {
      console.error('Error deleting notes:', error);
      toast.error('Failed to delete notes');
    }
  };

  const loadCurrentMeetings = () => {
    const now = new Date();
    const oneHourFromNow = addMinutes(now, 60);

    const current = meetings.filter(m => {
      const start = parseMeetingDate(m.start);
      const end = parseMeetingDate(m.end);
      if (!start || !end) return false;

      // Meeting is happening now or starts within next hour
      return (now >= start && now <= end) || (start >= now && start <= oneHourFromNow);
    }).sort((a, b) => parseMeetingDate(a.start) - parseMeetingDate(b.start));

    setCurrentMeetings(current);
  };

  const handleSelectCalendarEvent = (meeting) => {
    setSelectedCalendarEvent(meeting);
    setAdHocMeetingTitle(meeting.subject || '');
    setAdHocAttendees(
      meeting.attendees?.map(a => ({
        name: a.name,
        email: a.email
      })) || []
    );
  };

  const handleAdHocStaffSearch = async (query) => {
    if (!query || query.length < 2) {
      setAdHocSearchResults([]);
      return;
    }

    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {
        searchQuery: query
      });
      if (response.data.success && response.data.users) {
        setAdHocSearchResults(response.data.users);
      }
    } catch (error) {
      console.error('Error searching staff:', error);
    }
  };

  const handleAddAdHocAttendee = (person) => {
    if (!adHocAttendees.find(a => a.email === (person.mail || person.userPrincipalName))) {
      setAdHocAttendees([...adHocAttendees, {
        name: person.displayName,
        email: person.mail || person.userPrincipalName
      }]);
    }
    setAdHocSearchQuery('');
    setAdHocSearchResults([]);
  };

  const handleRemoveAdHocAttendee = (email) => {
    setAdHocAttendees(adHocAttendees.filter(a => a.email !== email));
  };

  const handleStartAdHocRecording = () => {
    if (!adHocMeetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }
    startRecording();
  };

  const handleGenerateAdHocNotes = async () => {
    if (!audioBlob || !user) {
      toast.error("Missing required data");
      return;
    }

    setProcessingNotes(true);
    const processingToast = toast.loading("Starting AI processing...");

    try {
      toast.loading("Uploading audio...", { id: processingToast });

      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new File([audioBlob], 'meeting-recording.mp3', { type: 'audio/mpeg' })
      });

      toast.loading("Audio uploaded! Processing with AI... (this may take 30-60 seconds)", { id: processingToast });

      const attendeesData = adHocAttendees.map(a => ({
        name: a.name,
        email: a.email
      }));

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI processing timed out after 2 minutes.')), 120000)
      );

      // Use selectedCalendarEvent for meeting_id and meeting_date if available
      const meetingIdForNotes = selectedCalendarEvent?.id || ('adhoc-' + Date.now());
      const meetingDateForNotes = selectedCalendarEvent?.start || new Date().toISOString();

      const notesPromise = base44.functions.invoke('transcribeMeetingAudio', {
        audio_url: uploadResponse.file_url,
        meeting_subject: adHocMeetingTitle,
        meeting_date: meetingDateForNotes,
        attendees: attendeesData
      });

      const notesResponse = await Promise.race([notesPromise, timeoutPromise]);

      if (!notesResponse.data || notesResponse.data.error) {
        throw new Error(notesResponse.data?.error || 'Failed to generate notes');
      }

      toast.loading("Saving notes...", { id: processingToast });

      const savedNote = await base44.entities.MeetingNote.create({
        meeting_id: meetingIdForNotes,
        meeting_subject: adHocMeetingTitle,
        meeting_date: meetingDateForNotes,
        user_email: user.email,
        audio_url: uploadResponse.file_url,
        summary: notesResponse.data.summary || '',
        key_points: notesResponse.data.key_points || [],
        outline: notesResponse.data.outline || [],
        action_items: notesResponse.data.action_items || [],
        speakers: notesResponse.data.speakers || [],
        transcript: notesResponse.data.transcript || '',
        transcript_segments: notesResponse.data.transcript_segments || [],
        recording_duration: recordingTime
      });

      setMeetingNotes(notesResponse.data);
      setSavedNotes(savedNote);
      await loadAllMeetingNotes(user);

      toast.success("Meeting notes generated and saved!", { id: processingToast });
      setActiveTab('notes');
      setShowAdHocRecording(false);

      // Reset ad-hoc state
      setAdHocMeetingTitle('');
      setAdHocAttendees([]);
      setAudioBlob(null);
      setIsRecording(false);
      setRecordingTime(0);
      setSelectedCalendarEvent(null);

    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error(`Failed: ${error.message}`, { id: processingToast });
    } finally {
      setProcessingNotes(false);
    }
  };

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
                onClick={() => setShowAdHocRecording(true)}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50"
              >
                <Mic className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Record Now</span>
              </Button>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="notes">
              AI Notes
              {allMeetingNotes.length > 0 && (
                <Badge variant="secondary" className="ml-2">{allMeetingNotes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meetings" className="space-y-6 mt-6">
            {/* Quick Actions */}
            <QuickActions />

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

            {/* My Bookings Section */}
            {myBookings.length > 0 && (
              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-purple-600" />
                    My Bookings
                    <Badge variant="secondary">{myBookings.length} booking{myBookings.length !== 1 ? 's' : ''}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBookings ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myBookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-white rounded-lg border border-purple-200 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 mb-2">{booking.title}</h3>
                              <div className="space-y-1 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {format(new Date(booking.start), 'MMM d, h:mm a')} - {format(new Date(booking.end), 'h:mm a')}
                                  </span>
                                </div>
                                {booking.customerName && (
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>{booking.customerName}</span>
                                    {booking.customerEmail && (
                                      <span className="text-slate-400 text-xs">({booking.customerEmail})</span>
                                    )}
                                  </div>
                                )}
                                {booking.location && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    <span>{booking.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {booking.meetingLink && (
                              <Button
                                size="sm"
                                onClick={() => window.open(booking.meetingLink, '_blank')}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                <Video className="w-4 h-4 mr-2" />
                                Join
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty State for Meetings tab, if no meetings or bookings */}
            {meetings.length === 0 && myBookings.length === 0 && (
                <Card className="border-none shadow-none">
                    <CardContent className="p-12 text-center">
                        <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No meetings or bookings found</h3>
                        <p className="text-slate-600">Your calendar and bookings are clear! Enjoy your day.</p>
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
          </TabsContent>

          <TabsContent value="notes" className="space-y-6 mt-6">
            {/* Search Bar with Delete All */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search notes by subject, summary, transcript, or action items..."
                  value={notesSearchQuery}
                  onChange={(e) => setNotesSearchQuery(e.target.value)}
                  className="pl-11 h-12 text-base"
                />
              </div>
              {allMeetingNotes.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleDeleteAllNotes}
                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All ({allMeetingNotes.length})
                </Button>
              )}
            </div>

            {/* Notes List */}
            {loadingNotes ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Loading AI notes...</p>
              </div>
            ) : Object.keys(filteredGroupedNotes).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {notesSearchQuery ? 'No notes found matching your search' : 'No meeting notes yet'}
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {notesSearchQuery
                      ? 'Try a different search term or clear the search to see all notes.'
                      : 'Record your meetings to create AI-powered notes.'
                    }
                  </p>
                  {notesSearchQuery && (
                    <Button variant="outline" onClick={() => setNotesSearchQuery('')}>
                      Clear Search
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(filteredGroupedNotes).map(([dateLabel, dateNotes]) => (
                  <div key={dateLabel}>
                    <h2 className="text-lg font-semibold text-slate-700 mb-4 sticky top-0 bg-gradient-to-br from-purple-50 to-pink-50 py-2 z-10">
                      {dateLabel}
                    </h2>
                    <div className="space-y-4">
                      {dateNotes.map((note) => (
                        <motion.div
                          key={note.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 p-6"
                        >
                          <EnhancedMeetingNotes
                            notes={note}
                            onDownload={() => downloadNotes(note)}
                            onDelete={() => handleDeleteNote(note.id)}
                            staffResults={staffForAssignment}
                            onSearchStaff={handleSearchStaffForAssignment}
                            onAssignPerson={(idx, person) => handleAssignActionItem(idx, person)}
                            onViewDetails={() => setViewingNoteDetail(note)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

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
              setAudioLevel(0); // Reset audio level on close
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
              }
              if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
              }
              if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
                analyserRef.current = null;
              }
            } else if (selectedMeeting) {
              loadSavedNotes(selectedMeeting.id);
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                                {/* Audio Level Meter */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-600">Level:</span>
                                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 transition-all duration-100"
                                      style={{ width: `${Math.min(audioLevel / 2.5, 100)}%` }}
                                    />
                                  </div>
                                </div>
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

                        {/* Meeting Notes Display - Use new component */}
                        {meetingNotes && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <EnhancedMeetingNotes
                              notes={{
                                ...meetingNotes,
                                meeting_subject: selectedMeeting?.subject,
                                meeting_date: selectedMeeting?.start,
                                recording_duration: recordingTime
                              }}
                              onDownload={() => downloadNotes(meetingNotes)}
                              staffResults={staffForAssignment}
                              onSearchStaff={handleSearchStaffForAssignment}
                              onAssignPerson={(actionItemIndex, person) => handleAssignActionItem(actionItemIndex, person)}
                            />
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

          {/* Detailed Notes Modal */}
          <DetailedMeetingNotesModal
            open={!!viewingNoteDetail}
            onOpenChange={(open) => !open && setViewingNoteDetail(null)}
            note={viewingNoteDetail}
            onUpdateSegmentSpeaker={(segmentIndex, person) =>
              handleUpdateSegmentSpeaker(viewingNoteDetail.id, segmentIndex, person)
            }
            staffResults={staffForAssignment}
            onSearchStaff={handleSearchStaffForAssignment}
          />

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
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedPerson.mail || selectedPerson.userPrincipalName}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Meeting Duration</label>
                    <Select
                      value={bookingData.serviceId}
                      onValueChange={(value) => setBookingData({...bookingData, serviceId: value})}
                      required
                      disabled={bookingServices.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select meeting length..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bookingServices.map(service => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - {service.description}
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

        {/* Ad-Hoc Recording Modal */}
        <Dialog open={showAdHocRecording} onOpenChange={(isOpen) => {
          if (isOpen) {
            loadCurrentMeetings();
          }
          if (!isOpen) {
            setShowAdHocRecording(false);
            setAdHocMeetingTitle('');
            setAdHocAttendees([]);
            setAudioBlob(null);
            setIsRecording(false);
            setRecordingTime(0);
            setSelectedCalendarEvent(null);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
            }
            if (audioContextRef.current) {
              audioContextRef.current.close();
              audioContextRef.current = null;
              analyserRef.current = null;
            }
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Ad-Hoc Meeting</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Calendar Event Selection */}
              {currentMeetings.length > 0 && !isRecording && (
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm font-medium text-purple-900">
                      Select from your calendar or enter manually:
                    </p>
                    <div className="space-y-2">
                      {currentMeetings.slice(0, 3).map((meeting) => {
                        const start = parseMeetingDate(meeting.start);
                        return (
                          <button
                            key={meeting.id}
                            onClick={() => handleSelectCalendarEvent(meeting)}
                            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                              selectedCalendarEvent?.id === meeting.id
                                ? 'border-purple-600 bg-purple-100'
                                : 'border-purple-200 bg-white hover:border-purple-400'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 truncate">{meeting.subject}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {start ? format(start, 'h:mm a') : 'Time N/A'}
                                  {meeting.attendees?.length > 0 && ` • ${meeting.attendees.length} attendee${meeting.attendees.length > 1 ? 's' : ''}`}
                                </p>
                              </div>
                              {selectedCalendarEvent?.id === meeting.id && (
                                <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Meeting Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting Title *</label>
                <Input
                  placeholder="e.g., Quick Team Sync"
                  value={adHocMeetingTitle}
                  onChange={(e) => {
                    setAdHocMeetingTitle(e.target.value);
                    setSelectedCalendarEvent(null);
                  }}
                  disabled={isRecording}
                />
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attendees (optional)</label>
                <div className="space-y-2">
                  {adHocAttendees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {adHocAttendees.map((attendee) => (
                        <Badge key={attendee.email} variant="outline" className="gap-1">
                          <User className="w-3 h-3" />
                          {attendee.name}
                          <button
                            onClick={() => handleRemoveAdHocAttendee(attendee.email)}
                            className="ml-1 hover:text-red-600"
                            disabled={isRecording}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isRecording}>
                        <User className="w-3 h-3 mr-2" />
                        Add Attendee
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search staff..."
                          value={adHocSearchQuery}
                          onValueChange={(value) => {
                            setAdHocSearchQuery(value);
                            handleAdHocStaffSearch(value);
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>No staff found</CommandEmpty>
                          <CommandGroup>
                            {adHocSearchResults.map((person) => (
                              <CommandItem
                                key={person.id}
                                onSelect={() => handleAddAdHocAttendee(person)}
                              >
                                <User className="w-4 h-4 mr-2" />
                                <div>
                                  <p className="font-medium">{person.displayName}</p>
                                  <p className="text-xs text-slate-500">{person.mail || person.userPrincipalName}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Recording Controls */}
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {!isRecording && !audioBlob && (
                      <Button
                        onClick={handleStartAdHocRecording}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={!adHocMeetingTitle.trim()}
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
                        {audioLevel > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600">Level:</span>
                            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all duration-100"
                                style={{ width: `${Math.min(audioLevel / 2.5, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {audioBlob && !meetingNotes && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-green-500 text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Recording saved ({formatRecordingTime(recordingTime)})
                        </Badge>
                        <Button
                          onClick={handleGenerateAdHocNotes}
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
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
        </Tabs>
      </div>
    </div>
  );
}