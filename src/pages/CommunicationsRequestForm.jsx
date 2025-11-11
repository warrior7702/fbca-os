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
import { MessageSquare, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function CommunicationsRequestForm() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    requester_name: "",
    requester_email: "",
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
        pco_event_date: formData.event_date || null,
        goal_review_data: {
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
        // Don't fail the whole submission if email fails
      }

      setSubmitted(true);
      toast.success("Request submitted successfully!");

      // Redirect after 3 seconds
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
      <div className="max-w-4xl mx-auto p-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg mb-6">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Communications Action Plan Request
          </h1>
          <p className="text-lg text-slate-600">
            Let's create something amazing together! ✨
          </p>
        </div>

        {/* Form */}
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Project Details
            </CardTitle>
            <p className="text-sm text-slate-600">Fill out the information below to get started</p>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Your Name */}
              <div className="space-y-2">
                <Label htmlFor="requester_name" className="text-base font-semibold">
                  Your Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="requester_name"
                  value={formData.requester_name}
                  onChange={(e) => handleChange("requester_name", e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              {/* Your Email */}
              <div className="space-y-2">
                <Label htmlFor="requester_email" className="text-base font-semibold">
                  Your Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="requester_email"
                  type="email"
                  value={formData.requester_email}
                  onChange={(e) => handleChange("requester_email", e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="project_name" className="text-base font-semibold">
                  Project Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="project_name"
                  value={formData.project_name}
                  onChange={(e) => handleChange("project_name", e.target.value)}
                  placeholder="e.g., Spring Revival 2025"
                  required
                  className="h-12"
                />
              </div>

              {/* Ministry/Department */}
              <div className="space-y-2">
                <Label htmlFor="ministry_department" className="text-base font-semibold">
                  Ministry/Department <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.ministry_department}
                  onValueChange={(value) => handleChange("ministry_department", value)}
                  required
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select ministry..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ministries.map(ministry => (
                      <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Event Theme */}
              <div className="space-y-2">
                <Label htmlFor="event_theme" className="text-base font-semibold">
                  Event Theme
                </Label>
                <Input
                  id="event_theme"
                  value={formData.event_theme}
                  onChange={(e) => handleChange("event_theme", e.target.value)}
                  placeholder="e.g., Unity in Christ"
                  className="h-12"
                />
              </div>

              {/* What do you need? */}
              <div className="space-y-2">
                <Label htmlFor="request_type" className="text-base font-semibold">
                  What do you need? <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.request_type}
                  onValueChange={(value) => handleChange("request_type", value)}
                  required
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select what you need..." />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Event Date & Time */}
              <div className="space-y-2">
                <Label htmlFor="event_date" className="text-base font-semibold">
                  Event Date & Time
                </Label>
                <Input
                  id="event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => handleChange("event_date", e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <Label htmlFor="project_description" className="text-base font-semibold">
                  Project Description
                </Label>
                <Textarea
                  id="project_description"
                  value={formData.project_description}
                  onChange={(e) => handleChange("project_description", e.target.value)}
                  placeholder="Tell us about your project, goals, and vision..."
                  rows={5}
                  className="resize-none"
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label htmlFor="target_audience" className="text-base font-semibold">
                  Target Audience
                </Label>
                <Input
                  id="target_audience"
                  value={formData.target_audience}
                  onChange={(e) => handleChange("target_audience", e.target.value)}
                  placeholder="e.g., Young families, College students, Church-wide"
                  className="h-12"
                />
              </div>

              {/* Success Metrics */}
              <div className="space-y-2">
                <Label htmlFor="success_metrics" className="text-base font-semibold">
                  How will you measure success?
                </Label>
                <Input
                  id="success_metrics"
                  value={formData.success_metrics}
                  onChange={(e) => handleChange("success_metrics", e.target.value)}
                  placeholder="e.g., 100 attendees, 50 social media shares"
                  className="h-12"
                />
              </div>

              {/* Budget Range */}
              <div className="space-y-2">
                <Label htmlFor="budget_range" className="text-base font-semibold">
                  Budget Range
                </Label>
                <Select
                  value={formData.budget_range}
                  onValueChange={(value) => handleChange("budget_range", value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select budget range..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="$0 - $500">$0 - $500</SelectItem>
                    <SelectItem value="$500 - $1,000">$500 - $1,000</SelectItem>
                    <SelectItem value="$1,000 - $2,500">$1,000 - $2,500</SelectItem>
                    <SelectItem value="$2,500 - $5,000">$2,500 - $5,000</SelectItem>
                    <SelectItem value="$5,000+">$5,000+</SelectItem>
                    <SelectItem value="Not sure">Not sure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <Label htmlFor="timeline" className="text-base font-semibold">
                  Desired Timeline
                </Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) => handleChange("timeline", value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="When do you need this?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASAP (within 1 week)">ASAP (within 1 week)</SelectItem>
                    <SelectItem value="2-3 weeks">2-3 weeks</SelectItem>
                    <SelectItem value="1 month">1 month</SelectItem>
                    <SelectItem value="2-3 months">2-3 months</SelectItem>
                    <SelectItem value="3+ months">3+ months</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    <>
                      Submit Request 🚀
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-600">
            Questions? Contact the Communications Team at{" "}
            <a href="mailto:communications@fbcarlington.org" className="text-purple-600 hover:underline">
              communications@fbcarlington.org
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}