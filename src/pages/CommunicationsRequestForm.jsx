import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Loader2, CheckCircle2, Sparkles, Calendar as CalendarIcon, Search, Image, Megaphone, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, addMonths, startOfDay, endOfDay } from "date-fns";

// Helper function to capitalize names properly
const capitalizeFullName = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(/[\s.]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export default function CommunicationsRequestForm() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const [pcoEvents, setPcoEvents] = useState([]);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("30"); // "30", "60", "90", "all"
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: "12", minute: "00", period: "PM" });
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
    is_event_related: "",
    event_source: "",
    pco_event_id: "",
    pco_event_name: "",
    pco_event_date: "",
    manual_event_name: "",
    project_name: "",
    ministry_department: "",
    event_theme: "",
    need_type: "",
    event_date: "",
    
    graphics_items: {
      digital_promo: false,
      flyers: false,
      metal_frame_signs: false,
      posters_11x17: false,
      postcards: false,
      a_frame_signs: false,
      posters_24x36: false,
      booklet: false,
      tshirt: false,
      something_else: false
    },
    previous_event_photos: null,
    graphics_folder_link: "",
    
    marketing_channels: {
      social_media: false,
      email_campaign: false,
      website: false,
      app_notification: false,
      blog_post: false,
      press_release: false
    },
    marketing_message: "",
    marketing_assets_link: "",
    
    project_description: "",
    target_audience: "",
    success_metrics: "",
    budget_range: "",
    timeline: ""
  });

  const ministries = [
    "Pastoral Care",
    "College Ministry",
    "Youth Ministry",
    "Children's Ministry",
    "Worship & Arts",
    "Missions & Outreach",
    "Small Groups",
    "Women's Ministry",
    "Men's Ministry",
    "Senior Adults",
    "Administration",
    "Facilities",
    "Other"
  ];

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      setFormData(prev => ({
        ...prev,
        requester_name: capitalizeFullName(currentUser.full_name) || "",
        requester_email: currentUser.email || ""
      }));
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load user information");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGraphicsItemChange = (item, checked) => {
    setFormData(prev => ({
      ...prev,
      graphics_items: {
        ...prev.graphics_items,
        [item]: checked
      }
    }));
  };

  const handleMarketingChannelChange = (channel, checked) => {
    setFormData(prev => ({
      ...prev,
      marketing_channels: {
        ...prev.marketing_channels,
        [channel]: checked
      }
    }));
  };

  // Construct full datetime from date and time
  const getFullDateTime = () => {
    if (!selectedDate) return "";
    
    let hour = parseInt(selectedTime.hour);
    if (selectedTime.period === "PM" && hour !== 12) {
      hour += 12;
    } else if (selectedTime.period === "AM" && hour === 12) {
      hour = 0;
    }
    
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hour);
    dateTime.setMinutes(parseInt(selectedTime.minute));
    
    return dateTime.toISOString();
  };

  // Update event_date when date/time changes
  useEffect(() => {
    if (selectedDate) {
      const fullDateTime = getFullDateTime();
      handleChange("event_date", fullDateTime);
    }
  }, [selectedDate, selectedTime]);

  const searchPCOEvents = async (range = dateRange) => {
    if (!user?.pco_access_token) {
      toast.error("Please connect Planning Center in Settings");
      return;
    }

    setSearchingEvents(true);
    try {
      const response = await base44.functions.invoke('getPCOToken');
      const token = response.data.access_token;

      // Calculate date range
      const now = new Date();
      let endDate;
      switch(range) {
        case "30":
          endDate = addDays(now, 30);
          break;
        case "60":
          endDate = addDays(now, 60);
          break;
        case "90":
          endDate = addDays(now, 90);
          break;
        case "all":
          endDate = addMonths(now, 12); // 1 year
          break;
        default:
          endDate = addDays(now, 30);
      }

      const eventsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const eventsData = await eventsResponse.json();
      
      const eventIds = [...new Set(eventsData.data.map(inst => 
        inst.relationships?.event?.data?.id
      ).filter(Boolean))];

      const events = await Promise.all(
        eventIds.map(async (eventId) => {
          try {
            const eventResponse = await fetch(
              `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            const eventData = await eventResponse.json();
            const instance = eventsData.data.find(inst => 
              inst.relationships?.event?.data?.id === eventId
            );
            
            return {
              id: eventId,
              name: eventData.data?.attributes?.name || 'Untitled',
              date: instance?.attributes?.starts_at,
              summary: eventData.data?.attributes?.summary
            };
          } catch (err) {
            console.error('Error fetching event:', eventId, err);
            return null;
          }
        })
      );

      // Filter by date range and sort
      const validEvents = events
        .filter(e => e !== null && e.date)
        .filter(e => {
          const eventDate = new Date(e.date);
          return eventDate >= now && eventDate <= endDate;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setPcoEvents(validEvents);
      toast.success(`Found ${validEvents.length} events in the next ${range === "all" ? "year" : range + " days"}`);
    } catch (error) {
      console.error('Error fetching PCO events:', error);
      toast.error('Failed to fetch events from PCO');
    } finally {
      setSearchingEvents(false);
    }
  };

  const handlePCOEventSelect = (event) => {
    const eventDate = new Date(event.date);
    
    // Extract date and time
    setSelectedDate(eventDate);
    
    const hours = eventDate.getHours();
    const minutes = eventDate.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    
    setSelectedTime({
      hour: displayHour.toString().padStart(2, '0'),
      minute: minutes.toString().padStart(2, '0'),
      period: period
    });
    
    setFormData(prev => ({
      ...prev,
      pco_event_id: event.id,
      pco_event_name: event.name,
      pco_event_date: event.date,
      event_date: event.date,
      project_name: event.name,
      manual_event_name: event.name
    }));
    setEventSearchQuery("");
  };

  const filteredEvents = pcoEvents.filter(event => 
    event.name.toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFormData(prev => ({
        ...prev,
        previous_event_photos: Array.from(files)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.project_name && !formData.manual_event_name) {
      toast.error("Please provide a project/event name");
      return;
    }
    if (!formData.ministry_department || !formData.need_type || !formData.event_date) {
      toast.error("Please fill out all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const requestNumber = `CR-${Date.now().toString().slice(-6)}`;
      const finalProjectName = formData.manual_event_name || formData.project_name;

      let photoUrls = [];
      if (formData.previous_event_photos) {
        for (const file of formData.previous_event_photos) {
          try {
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            photoUrls.push(uploadResult.file_url);
          } catch (err) {
            console.error('Error uploading file:', err);
          }
        }
      }

      const request = await base44.entities.WorkflowRequest.create({
        request_number: requestNumber,
        type: "manual_form",
        status: "request",
        priority: "medium",
        title: finalProjectName,
        description: formData.project_description || `${formData.need_type} request for ${formData.ministry_department}`,
        requestor_email: formData.requester_email,
        requestor_name: formData.requester_name,
        ministry_department: formData.ministry_department,
        pco_event_id: formData.pco_event_id || null,
        pco_event_name: formData.pco_event_name || null,
        pco_event_date: formData.pco_event_date || formData.event_date || null,
        goal_review_data: {
          is_event_related: formData.is_event_related,
          event_source: formData.event_source,
          need_type: formData.need_type,
          graphics_items: formData.graphics_items,
          marketing_channels: formData.marketing_channels,
          marketing_message: formData.marketing_message,
          marketing_assets_link: formData.marketing_assets_link,
          graphics_folder_link: formData.graphics_folder_link,
          previous_event_photos: photoUrls,
          ministry_goal: formData.project_description,
          target_audience: formData.target_audience,
          success_metrics: formData.success_metrics,
          budget_range: formData.budget_range,
          timeline: formData.timeline,
          event_theme: formData.event_theme,
          event_date: formData.event_date,
          manual_event_name: formData.manual_event_name
        },
        conversation_history: [{
          timestamp: new Date().toISOString(),
          author: formData.requester_name,
          message: `Request submitted via form: ${formData.need_type}`,
          is_internal: false
        }]
      });

      console.log('✅ Request created:', request.id);

      try {
        await base44.integrations.Core.SendEmail({
          from_name: 'Communications Team',
          to: formData.requester_email,
          subject: `Communications Action Plan: ${finalProjectName}`,
          body: `Hello ${formData.requester_name},

Thank you for submitting your communications action plan!

Request Number: ${requestNumber}
Project: ${finalProjectName}
Ministry: ${formData.ministry_department}
Type: ${formData.need_type}

Our communications team will review your request and reach out within 1-2 business days to discuss your needs.

You can track your request at: ${window.location.origin}${createPageUrl('WorkflowDetail')}?id=${request.id}

Best regards,
Communications Team
FBC Arlington`
        });

        console.log('✅ Confirmation email sent');
      } catch (emailError) {
        console.error('Email send failed (non-critical):', emailError);
      }

      setSubmitted(true);
      toast.success("Request submitted successfully!");

      setTimeout(() => {
        navigate(createPageUrl('WorkflowDetail') + `?id=${request.id}`);
      }, 3000);

    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-2 border-green-300 bg-white">
            <CardContent className="p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Request Submitted! 🎉
              </h2>
              <p className="text-slate-600 mb-6">
                Your communications action plan has been received. We'll review it and reach out within 1-2 business days.
              </p>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 mb-6">
                <p className="text-sm text-green-800">
                  <strong>Redirecting to your request details...</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg mb-4">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Communications Action Plan
          </h1>
          <p className="text-slate-600">
            Let's create something amazing together! ✨
          </p>
        </div>

        {/* Form */}
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Project Details
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="requester_name" className="text-sm font-medium">
                    Your Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="requester_name"
                    value={formData.requester_name}
                    onChange={(e) => handleChange("requester_name", e.target.value)}
                    required
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="requester_email" className="text-sm font-medium">
                    Your Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="requester_email"
                    type="email"
                    value={formData.requester_email}
                    onChange={(e) => handleChange("requester_email", e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
              </div>

              {/* Event Related Question */}
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label className="text-sm font-semibold text-blue-900">
                  Is this related to an event? <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.is_event_related}
                  onValueChange={(value) => {
                    handleChange("is_event_related", value);
                    if (value === "no") {
                      handleChange("event_source", "");
                      handleChange("pco_event_id", "");
                      handleChange("pco_event_name", "");
                      handleChange("pco_event_date", "");
                      setPcoEvents([]);
                      setEventSearchQuery("");
                    }
                  }}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="event-yes" />
                    <Label htmlFor="event-yes" className="cursor-pointer font-normal">
                      Yes, existing event
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="event-no" />
                    <Label htmlFor="event-no" className="cursor-pointer font-normal">
                      No, new initiative
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* BRANCH: Existing Event */}
              <AnimatePresence>
                {formData.is_event_related === "yes" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pl-4 border-l-4 border-blue-300"
                  >
                    {/* PCO Event Search with Date Range Tabs */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Search PCO Calendar Event
                      </Label>
                      
                      {searchingEvents ? (
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          <span className="text-sm text-slate-600">Loading events...</span>
                        </div>
                      ) : (
                        <>
                          {/* Date Range Tabs */}
                          <Tabs value={dateRange} onValueChange={(value) => {
                            setDateRange(value);
                            if (pcoEvents.length > 0) {
                              searchPCOEvents(value);
                            }
                          }} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                              <TabsTrigger value="30">Next 30 Days</TabsTrigger>
                              <TabsTrigger value="60">60 Days</TabsTrigger>
                              <TabsTrigger value="90">90 Days</TabsTrigger>
                              <TabsTrigger value="all">All</TabsTrigger>
                            </TabsList>
                          </Tabs>

                          {pcoEvents.length > 0 ? (
                            <>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                  type="text"
                                  placeholder="Type event name to search..."
                                  value={eventSearchQuery}
                                  onChange={(e) => setEventSearchQuery(e.target.value)}
                                  className="pl-10 h-10"
                                />
                              </div>

                              {formData.pco_event_id && (
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-semibold text-purple-900">{formData.pco_event_name}</p>
                                      <p className="text-sm text-purple-700">
                                        {formData.pco_event_date ? format(new Date(formData.pco_event_date), 'EEEE, MMMM d, yyyy - h:mm a') : 'No date'}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        handleChange("pco_event_id", "");
                                        handleChange("pco_event_name", "");
                                        handleChange("pco_event_date", "");
                                        setSelectedDate(null);
                                      }}
                                    >
                                      Change
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {!formData.pco_event_id && (
                                <div className="max-h-64 overflow-y-auto border rounded-lg">
                                  {filteredEvents.length > 0 ? (
                                    <div className="divide-y">
                                      {filteredEvents.slice(0, 20).map(event => (
                                        <button
                                          key={event.id}
                                          type="button"
                                          onClick={() => handlePCOEventSelect(event)}
                                          className="w-full p-3 hover:bg-purple-50 transition-colors text-left"
                                        >
                                          <p className="font-medium text-slate-900">{event.name}</p>
                                          <p className="text-sm text-slate-600">
                                            {event.date ? format(new Date(event.date), 'EEE, MMM d, yyyy - h:mm a') : 'No date'}
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-8 text-center text-slate-500">
                                      <p>No events found</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <p className="text-xs text-slate-500">
                                Showing {filteredEvents.length} of {pcoEvents.length} events
                              </p>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => searchPCOEvents()}
                              className="w-full"
                            >
                              <Search className="w-4 h-4 mr-2" />
                              Load Events
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Manual Event Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="manual_event_name" className="text-sm font-medium">
                        Event Name {!formData.pco_event_id && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        id="manual_event_name"
                        value={formData.manual_event_name}
                        onChange={(e) => handleChange("manual_event_name", e.target.value)}
                        placeholder="Enter event name if not found above"
                        required={formData.is_event_related === "yes" && !formData.pco_event_id}
                        className="h-10"
                      />
                      <p className="text-xs text-slate-500">
                        Type the event name if you can't find it in the search
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* BRANCH: New Initiative */}
              <AnimatePresence>
                {formData.is_event_related === "no" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pl-4 border-l-4 border-green-300"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="project_name" className="text-sm font-medium">
                        Project/Initiative Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="project_name"
                        value={formData.project_name}
                        onChange={(e) => handleChange("project_name", e.target.value)}
                        placeholder="e.g., Fall Outreach Campaign"
                        required={formData.is_event_related === "no"}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="event_theme" className="text-sm font-medium">
                        Theme/Message
                      </Label>
                      <Input
                        id="event_theme"
                        value={formData.event_theme}
                        onChange={(e) => handleChange("event_theme", e.target.value)}
                        placeholder="e.g., Unity in Christ"
                        className="h-10"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SECOND BRANCH: What do you need? */}
              {formData.is_event_related && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 pt-4 border-t"
                >
                  {/* Ministry */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ministry_department" className="text-sm font-medium">
                      Ministry <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.ministry_department}
                      onValueChange={(value) => handleChange("ministry_department", value)}
                      required
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ministries.map(ministry => (
                          <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* What do you need? */}
                  <div className="space-y-2 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <Label className="text-sm font-semibold text-orange-900">
                      What do you need? <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      value={formData.need_type}
                      onValueChange={(value) => handleChange("need_type", value)}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="graphics" id="need-graphics" />
                        <Label htmlFor="need-graphics" className="cursor-pointer font-normal flex items-center gap-2">
                          <Image className="w-4 h-4 text-orange-600" />
                          Graphics Only
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="marketing" id="need-marketing" />
                        <Label htmlFor="need-marketing" className="cursor-pointer font-normal flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-orange-600" />
                          Marketing Only
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="both" id="need-both" />
                        <Label htmlFor="need-both" className="cursor-pointer font-normal flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-orange-600" />
                          Both Graphics & Marketing
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Beautiful Date & Time Picker */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Event Date & Time <span className="text-red-500">*</span>
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Date Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`justify-start text-left font-normal h-10 ${!selectedDate && "text-muted-foreground"}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Time Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="justify-start text-left font-normal h-10"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {selectedTime.hour}:{selectedTime.minute} {selectedTime.period}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Select Time</Label>
                            <div className="flex gap-2">
                              <Select
                                value={selectedTime.hour}
                                onValueChange={(value) => setSelectedTime(prev => ({ ...prev, hour: value }))}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => {
                                    const hour = (i + 1).toString().padStart(2, '0');
                                    return <SelectItem key={hour} value={hour}>{hour}</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>

                              <span className="flex items-center">:</span>

                              <Select
                                value={selectedTime.minute}
                                onValueChange={(value) => setSelectedTime(prev => ({ ...prev, minute: value }))}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["00", "15", "30", "45"].map(min => (
                                    <SelectItem key={min} value={min}>{min}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={selectedTime.period}
                                onValueChange={(value) => setSelectedTime(prev => ({ ...prev, period: value }))}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AM">AM</SelectItem>
                                  <SelectItem value="PM">PM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {selectedDate && (
                      <p className="text-xs text-slate-500">
                        {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime.hour}:{selectedTime.minute} {selectedTime.period}
                      </p>
                    )}
                  </div>

                  {/* GRAPHICS FIELDS */}
                  <AnimatePresence>
                    {(formData.need_type === "graphics" || formData.need_type === "both") && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pl-4 border-l-4 border-purple-300"
                      >
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Image className="w-5 h-5 text-purple-600" />
                          Graphics Items
                        </h3>
                        
                        <div className="space-y-2">
                          <Label className="text-sm">Select all the design items you need:</Label>
                          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg">
                            {[
                              { id: 'digital_promo', label: 'Digital Promotion Package' },
                              { id: 'flyers', label: 'Flyers' },
                              { id: 'metal_frame_signs', label: 'Metal Frame (Top 5) Signs' },
                              { id: 'posters_11x17', label: 'Posters (11x17)' },
                              { id: 'postcards', label: 'Postcards' },
                              { id: 'a_frame_signs', label: 'A Frame Signs' },
                              { id: 'posters_24x36', label: 'Posters (24x36)' },
                              { id: 'booklet', label: 'Booklet' },
                              { id: 'tshirt', label: 'T-shirt' },
                              { id: 'something_else', label: 'Something Else' }
                            ].map(item => (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={item.id}
                                  checked={formData.graphics_items[item.id]}
                                  onCheckedChange={(checked) => handleGraphicsItemChange(item.id, checked)}
                                />
                                <Label htmlFor={item.id} className="text-sm cursor-pointer">
                                  {item.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="previous_photos" className="text-sm font-medium">
                            Previous Event Photos (Optional)
                          </Label>
                          <p className="text-xs text-slate-500 mb-2">
                            If you have any pictures from previous events, you can drop them here. If not, no worries!
                          </p>
                          <Input
                            id="previous_photos"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="graphics_folder_link" className="text-sm font-medium">
                            Link to Graphics Folder (Optional)
                          </Label>
                          <Input
                            id="graphics_folder_link"
                            value={formData.graphics_folder_link}
                            onChange={(e) => handleChange("graphics_folder_link", e.target.value)}
                            placeholder="Paste the link to your graphics folder here..."
                            className="h-10"
                          />
                          <p className="text-xs text-slate-500">
                            Share a link to existing graphics or assets
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* MARKETING FIELDS */}
                  <AnimatePresence>
                    {(formData.need_type === "marketing" || formData.need_type === "both") && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pl-4 border-l-4 border-pink-300"
                      >
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Megaphone className="w-5 h-5 text-pink-600" />
                          Marketing Channels
                        </h3>
                        
                        <div className="space-y-2">
                          <Label className="text-sm">Select marketing channels you need:</Label>
                          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg">
                            {[
                              { id: 'social_media', label: 'Social Media Posts' },
                              { id: 'email_campaign', label: 'Email Campaign' },
                              { id: 'website', label: 'Website Updates' },
                              { id: 'app_notification', label: 'App Notification' },
                              { id: 'blog_post', label: 'Blog Post' },
                              { id: 'press_release', label: 'Press Release' }
                            ].map(channel => (
                              <div key={channel.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={channel.id}
                                  checked={formData.marketing_channels[channel.id]}
                                  onCheckedChange={(checked) => handleMarketingChannelChange(channel.id, checked)}
                                />
                                <Label htmlFor={channel.id} className="text-sm cursor-pointer">
                                  {channel.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="marketing_message" className="text-sm font-medium">
                            Key Marketing Message
                          </Label>
                          <Textarea
                            id="marketing_message"
                            value={formData.marketing_message}
                            onChange={(e) => handleChange("marketing_message", e.target.value)}
                            placeholder="What's the main message you want to communicate?"
                            rows={3}
                            className="resize-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="marketing_assets_link" className="text-sm font-medium">
                            Link to Marketing Assets (Optional)
                          </Label>
                          <Input
                            id="marketing_assets_link"
                            value={formData.marketing_assets_link}
                            onChange={(e) => handleChange("marketing_assets_link", e.target.value)}
                            placeholder="Share links to existing content, brand guidelines, etc..."
                            className="h-10"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Common Additional Fields */}
                  {formData.need_type && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4 pt-4 border-t"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="project_description" className="text-sm font-medium">
                          Project Description
                        </Label>
                        <Textarea
                          id="project_description"
                          value={formData.project_description}
                          onChange={(e) => handleChange("project_description", e.target.value)}
                          placeholder="Tell us about your project, goals, and vision..."
                          rows={4}
                          className="resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="target_audience" className="text-sm font-medium">
                            Target Audience
                          </Label>
                          <Input
                            id="target_audience"
                            value={formData.target_audience}
                            onChange={(e) => handleChange("target_audience", e.target.value)}
                            placeholder="e.g., Young families"
                            className="h-10"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="timeline" className="text-sm font-medium">
                            Timeline
                          </Label>
                          <Select
                            value={formData.timeline}
                            onValueChange={(value) => handleChange("timeline", value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="When?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ASAP">ASAP (1 week)</SelectItem>
                              <SelectItem value="2-3 weeks">2-3 weeks</SelectItem>
                              <SelectItem value="1 month">1 month</SelectItem>
                              <SelectItem value="2-3 months">2-3 months</SelectItem>
                              <SelectItem value="Flexible">Flexible</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="budget_range" className="text-sm font-medium">
                            Budget Range
                          </Label>
                          <Select
                            value={formData.budget_range}
                            onValueChange={(value) => handleChange("budget_range", value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="$0 - $500">$0 - $500</SelectItem>
                              <SelectItem value="$500 - $1,000">$500 - $1,000</SelectItem>
                              <SelectItem value="$1,000 - $2,500">$1,000 - $2,500</SelectItem>
                              <SelectItem value="$2,500+">$2,500+</SelectItem>
                              <SelectItem value="Not sure">Not sure</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="success_metrics" className="text-sm font-medium">
                            Success Metric
                          </Label>
                          <Input
                            id="success_metrics"
                            value={formData.success_metrics}
                            onChange={(e) => handleChange("success_metrics", e.target.value)}
                            placeholder="e.g., 100 attendees"
                            className="h-10"
                          />
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="pt-4">
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              Submit Request 🚀
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-600">
            Questions? Contact{" "}
            <a href="mailto:communications@fbcarlington.org" className="text-purple-600 hover:underline">
              communications@fbcarlington.org
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}