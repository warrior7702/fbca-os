import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquare, Loader2, CheckCircle2, Sparkles, Calendar, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function CommunicationsRequestForm() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const [pcoEvents, setPcoEvents] = useState([]);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
    is_event_related: "", // "yes" or "no"
    event_source: "", // "pco" or "email" (for existing events)
    pco_event_id: "",
    pco_event_name: "",
    pco_event_date: "",
    project_name: "",
    ministry_department: "",
    event_theme: "",
    request_type: "",
    event_date: "",
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

  const requestTypes = [
    "Graphics Only",
    "Marketing Only",
    "Both Graphics & Marketing",
    "Social Media Campaign",
    "Email Campaign",
    "Print Materials",
    "Video Production",
    "Website Updates",
    "Event Promotion"
  ];

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Pre-fill user info
      setFormData(prev => ({
        ...prev,
        requester_name: currentUser.full_name || "",
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

  const searchPCOEvents = async () => {
    if (!user?.pco_access_token) {
      toast.error("Please connect Planning Center in Settings");
      return;
    }

    setSearchingEvents(true);
    try {
      // Get future events
      const response = await base44.functions.invoke('getPCOToken');
      const token = response.data.access_token;

      const eventsResponse = await fetch(
        'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=20&order=starts_at',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const eventsData = await eventsResponse.json();
      
      // Get unique events with their details
      const eventIds = [...new Set(eventsData.data.map(inst => 
        inst.relationships?.event?.data?.id
      ).filter(Boolean))];

      const events = await Promise.all(
        eventIds.slice(0, 10).map(async (eventId) => {
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
        })
      );

      setPcoEvents(events);
    } catch (error) {
      console.error('Error fetching PCO events:', error);
      toast.error('Failed to fetch events from PCO');
    } finally {
      setSearchingEvents(false);
    }
  };

  const handlePCOEventSelect = (eventId) => {
    const event = pcoEvents.find(e => e.id === eventId);
    if (event) {
      setFormData(prev => ({
        ...prev,
        pco_event_id: event.id,
        pco_event_name: event.name,
        pco_event_date: event.date,
        project_name: event.name
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.project_name || !formData.ministry_department || !formData.request_type) {
      toast.error("Please fill out all required fields");
      return;
    }

    setSubmitting(true);

    try {
      // Generate request number
      const requestNumber = `CR-${Date.now().toString().slice(-6)}`;

      // Create WorkflowRequest
      const request = await base44.entities.WorkflowRequest.create({
        request_number: requestNumber,
        type: "manual_form",
        status: "request",
        priority: "medium",
        title: formData.project_name,
        description: formData.project_description || `${formData.request_type} request for ${formData.ministry_department}`,
        requestor_email: formData.requester_email,
        requestor_name: formData.requester_name,
        ministry_department: formData.ministry_department,
        pco_event_id: formData.pco_event_id || null,
        pco_event_name: formData.pco_event_name || null,
        pco_event_date: formData.pco_event_date || formData.event_date || null,
        goal_review_data: {
          is_event_related: formData.is_event_related,
          event_source: formData.event_source,
          ministry_goal: formData.project_description,
          target_audience: formData.target_audience,
          success_metrics: formData.success_metrics,
          budget_range: formData.budget_range,
          timeline: formData.timeline,
          event_theme: formData.event_theme,
          request_type: formData.request_type
        },
        conversation_history: [{
          timestamp: new Date().toISOString(),
          author: formData.requester_name,
          message: `Request submitted via form: ${formData.request_type}`,
          is_internal: false
        }]
      });

      console.log('✅ Request created:', request.id);

      // Send confirmation email
      try {
        await base44.integrations.Core.SendEmail({
          from_name: 'Communications Team',
          to: formData.requester_email,
          subject: `Communications Request Received: ${formData.project_name}`,
          body: `Hello ${formData.requester_name},

Thank you for submitting your communications request!

Request Number: ${requestNumber}
Project: ${formData.project_name}
Ministry: ${formData.ministry_department}
Type: ${formData.request_type}

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
                Your communications request has been received. We'll review it and reach out within 1-2 business days.
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
            Communications Action Plan Request
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
              {/* Name & Email - Compact Row */}
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
                    // Reset event-related fields when changing
                    if (value === "no") {
                      handleChange("event_source", "");
                      handleChange("pco_event_id", "");
                      handleChange("pco_event_name", "");
                      handleChange("pco_event_date", "");
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
                    {/* Event Source */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Where is this event from? <span className="text-red-500">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={formData.event_source === "pco" ? "default" : "outline"}
                          onClick={() => {
                            handleChange("event_source", "pco");
                            searchPCOEvents();
                          }}
                          className={formData.event_source === "pco" ? "bg-purple-600" : ""}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          PCO Calendar
                        </Button>
                        <Button
                          type="button"
                          variant={formData.event_source === "email" ? "default" : "outline"}
                          onClick={() => handleChange("event_source", "email")}
                          disabled
                          className="opacity-50"
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Email Request (Coming Soon)
                        </Button>
                      </div>
                    </div>

                    {/* PCO Event Selection */}
                    {formData.event_source === "pco" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <Label className="text-sm font-medium">
                          Select Event <span className="text-red-500">*</span>
                        </Label>
                        {searchingEvents ? (
                          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                            <span className="text-sm text-slate-600">Loading events...</span>
                          </div>
                        ) : pcoEvents.length > 0 ? (
                          <Select
                            value={formData.pco_event_id}
                            onValueChange={handlePCOEventSelect}
                            required
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select an event..." />
                            </SelectTrigger>
                            <SelectContent>
                              {pcoEvents.map(event => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.name} - {event.date ? new Date(event.date).toLocaleDateString() : 'No date'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={searchPCOEvents}
                            className="w-full"
                          >
                            <Search className="w-4 h-4 mr-2" />
                            Search PCO Events
                          </Button>
                        )}
                      </motion.div>
                    )}
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
                    {/* Project Name */}
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

                    {/* Event Theme */}
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

              {/* Common Fields (shown after event question is answered) */}
              {formData.is_event_related && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 pt-4 border-t"
                >
                  {/* Ministry & Request Type Row */}
                  <div className="grid grid-cols-2 gap-4">
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

                    <div className="space-y-1.5">
                      <Label htmlFor="request_type" className="text-sm font-medium">
                        What do you need? <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.request_type}
                        onValueChange={(value) => handleChange("request_type", value)}
                        required
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {requestTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Event Date (for new initiatives only) */}
                  {formData.is_event_related === "no" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="event_date" className="text-sm font-medium">
                        Target Date
                      </Label>
                      <Input
                        id="event_date"
                        type="datetime-local"
                        value={formData.event_date}
                        onChange={(e) => handleChange("event_date", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  )}

                  {/* Description */}
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

                  {/* Target Audience & Timeline Row */}
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

                  {/* Budget & Success Metrics Row */}
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