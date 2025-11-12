import React, { useState, useEffect, useRef } from "react";
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
import { MessageSquare, Loader2, CheckCircle2, Sparkles, Calendar as CalendarIcon, Search, Image, Megaphone, Clock, Upload, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

// Helper function to capitalize names properly
const capitalizeFullName = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(/[\s.]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Custom debounce hook
const useDebounced = (value, delay = 450) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

export default function CommunicationsRequestForm() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const [pcoEvents, setPcoEvents] = useState([]);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounced(eventSearchQuery, 450);
  const [searchError, setSearchError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: "12", minute: "00", period: "PM" });
  const [photoUploadMethod, setPhotoUploadMethod] = useState("upload");
  const [validationErrors, setValidationErrors] = useState({});
  const abortControllerRef = useRef(null);
  const searchCacheRef = useRef(new Map());
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
    previous_event_photos_link: "",
    graphics_folder_link: "",
    
    marketing_channels: {
      social_media: false,
      email_campaign: false,
      website: false,
      app_notification: false,
      blog_post: false,
      press_release: false
    },
    marketing_assets_link: ""
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

  // Debounced search with caching and abort control
  useEffect(() => {
    const searchTerm = debouncedSearchQuery.trim();
    
    // Clear results if query is too short
    if (searchTerm.length < 3) {
      setPcoEvents([]);
      setSearchError(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache
    const cacheKey = searchTerm.toLowerCase();
    if (searchCacheRef.current.has(cacheKey)) {
      console.log('✅ Using cached results for:', searchTerm);
      setPcoEvents(searchCacheRef.current.get(cacheKey));
      return;
    }

    // Perform search
    searchPCOEvents(searchTerm);
  }, [debouncedSearchQuery]);

  const searchPCOEvents = async (searchTerm) => {
    if (!user?.pco_access_token) {
      toast.error("Please connect Planning Center in Settings");
      return;
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setSearchingEvents(true);
    setSearchError(null);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const response = await base44.functions.invoke('getPCOToken');
        const token = response.data.access_token;

        // Date window: past 30 days to +180 days (6 months)
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

        // Single list query - fetch event instances in date range
        const eventsResponse = await fetch(
          'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal
          }
        );

        // Handle rate limiting
        if (eventsResponse.status === 429) {
          const retryAfter = parseInt(eventsResponse.headers.get('Retry-After') || '1');
          const waitTime = Math.min(retryAfter, 5) * 1000;
          console.warn(`⚠️ Rate limited. Waiting ${waitTime}ms...`);
          
          if (attempts >= maxAttempts) {
            throw new Error('Rate limit exceeded. Please try again in a moment.');
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!eventsResponse.ok) {
          throw new Error(`PCO API error: ${eventsResponse.status}`);
        }

        const eventsData = await eventsResponse.json();
        
        // Get unique event IDs
        const eventIds = [...new Set(eventsData.data.map(inst => 
          inst.relationships?.event?.data?.id
        ).filter(Boolean))];

        // Fetch event details (only names and dates - minimal data)
        const events = await Promise.all(
          eventIds.slice(0, 50).map(async (eventId) => {
            try {
              const eventResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  signal
                }
              );
              
              if (!eventResponse.ok) return null;
              
              const eventData = await eventResponse.json();
              const instance = eventsData.data.find(inst => 
                inst.relationships?.event?.data?.id === eventId
              );
              
              return {
                id: eventId,
                name: eventData.data?.attributes?.name || 'Untitled',
                date: instance?.attributes?.starts_at,
                location: eventData.data?.attributes?.location
              };
            } catch (err) {
              if (err.name === 'AbortError') throw err;
              return null;
            }
          })
        );

        // Filter by search term and date range
        const validEvents = events
          .filter(e => e !== null && e.date)
          .filter(e => {
            const eventDate = new Date(e.date);
            const matchesDate = eventDate >= startDate && eventDate <= endDate;
            const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesDate && matchesSearch;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Cache the results
        searchCacheRef.current.set(searchTerm.toLowerCase(), validEvents);

        setPcoEvents(validEvents);
        console.log(`✅ Found ${validEvents.length} events matching "${searchTerm}"`);
        
        break; // Success, exit retry loop

      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('🚫 Search aborted');
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.error('❌ Search failed after retries:', error);
          setSearchError(error.message || 'Search failed');
          setPcoEvents([]);
          return;
        }
        
        // Wait before retry with exponential backoff
        const waitTime = 500 * attempts;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } finally {
        if (attempts >= maxAttempts || signal.aborted) {
          setSearchingEvents(false);
        }
      }
    }

    setSearchingEvents(false);
  };

  const handlePCOEventSelect = (event) => {
    const eventDate = new Date(event.date);
    
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
    setPcoEvents([]);
    setValidationErrors(prev => ({ ...prev, event_name: undefined, event_date: undefined }));
  };

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
    
    // Clear previous errors
    const errors = {};
    
    // Validate required fields
    if (!formData.is_event_related) {
      errors.is_event_related = "Please answer if this is event-related";
    }

    if (formData.is_event_related === "yes") {
      if (!formData.pco_event_id && !formData.manual_event_name) {
        errors.event_name = "Please provide an event name or select from PCO";
      }
    } else if (formData.is_event_related === "no") {
      if (!formData.project_name) {
        errors.event_name = "Please provide a project name";
      }
    }
    
    if (!formData.ministry_department) {
      errors.ministry_department = "Please select a ministry";
    }
    if (!formData.need_type) {
      errors.need_type = "Please select what you need";
    }
    if (!formData.event_date) {
      errors.event_date = "Please select an event date";
    }
    
    // If there are errors, show them and stop
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill out all required fields");
      
      // Scroll to first error
      const firstErrorElement = document.querySelector('[data-validation-error="true"]');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      return;
    }
    
    // Clear validation errors if everything is valid
    setValidationErrors({});

    setSubmitting(true);

    try {
      const requestNumber = `CR-${Date.now().toString().slice(-6)}`;
      const finalProjectName = formData.manual_event_name || formData.project_name;

      let photoUrls = [];
      
      if (photoUploadMethod === "upload" && formData.previous_event_photos) {
        for (const file of formData.previous_event_photos) {
          try {
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            photoUrls.push(uploadResult.file_url);
          } catch (err) {
            console.error('Error uploading file:', err);
          }
        }
      } else if (photoUploadMethod === "link" && formData.previous_event_photos_link) {
        photoUrls = [formData.previous_event_photos_link];
      }

      // Email tracking variables
      let emailSent = false;
      let emailSentAt = null;
      let emailError = null;

      // Create request FIRST with email_sent: false
      const request = await base44.entities.WorkflowRequest.create({
        request_number: requestNumber,
        type: "manual_form",
        status: "minister_goal_review",
        priority: "medium",
        title: finalProjectName,
        description: `${formData.need_type} request for ${formData.ministry_department}`,
        requestor_email: formData.requester_email,
        requestor_name: formData.requester_name,
        ministry_department: formData.ministry_department,
        pco_event_id: formData.pco_event_id || null,
        pco_event_name: formData.pco_event_name || null,
        pco_event_date: formData.pco_event_date || formData.event_date || null,
        email_sent: false,
        email_sent_at: null,
        email_error: null,
        goal_review_data: {
          is_event_related: formData.is_event_related,
          event_source: formData.event_source,
          need_type: formData.need_type,
          graphics_items: formData.graphics_items,
          marketing_channels: formData.marketing_channels,
          marketing_assets_link: formData.marketing_assets_link,
          graphics_folder_link: formData.graphics_folder_link,
          previous_event_photos: photoUrls,
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

      // NOW send the email and track result
      try {
        console.log('📧 Attempting to send intake email to:', formData.requester_email);
        
        const baseUrl = window.location.origin;
        const intakeLink = `${baseUrl}/workflowdetail?id=${request.id}`;
        
        await base44.integrations.Core.SendEmail({
          from_name: 'FBC Arlington Communications',
          to: formData.requester_email,
          subject: `📋 Communications Review and Planning: ${finalProjectName}`,
          body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Communications Review and Planning</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f8fa; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f7f8fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.15); width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">📋</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Communications Review and Planning</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Action Required</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Hi <strong>${formData.requester_name}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Lets take some time to learn more about your Communications needs
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📅 Project</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${finalProjectName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🏢 Ministry</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${formData.ministry_department}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Request #</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace;">${requestNumber}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 700;">✨ Next Step: Complete Your Minister Goal Review</h2>
                <p style="margin: 0 0 24px; color: rgba(255, 255, 255, 0.95); font-size: 14px; line-height: 1.6;">
                  We've streamlined our process with a quick 5-minute interview that will gather all the details we need to create the perfect communications plan.
                </p>
                <a href="${intakeLink}" style="display: inline-block; background-color: #ffffff; color: #7c3aed; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  Start Your Goal Review →
                </a>
              </div>
              
              <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 17px; font-weight: 700;">What to expect:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Quick Q&A about your event (5 minutes)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Questions about theme, audience, goals, and logistics</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">No need to prepare - just answer naturally</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">You can skip questions if unsure</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 12px; color: #166534; font-size: 16px; font-weight: 700;">After you complete the intake:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Our communications team will review your responses</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">We'll create a detailed project plan</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Tasks will be assigned to our design & marketing team</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">You'll be able to track progress in real-time</span>
                    </td>
                  </tr>
                </table>
              </div>
              
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
                Questions? Contact us at
              </p>
              <p style="margin: 0 0 20px;">
                <a href="mailto:kyle.judkins@fbca.org" style="color: #7c3aed; text-decoration: none; font-weight: 600; font-size: 15px;">
                  📧 kyle.judkins@fbca.org
                </a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                Looking forward to making your project a success!<br>
                <strong style="color: #64748b;">— Communications Team, FBC Arlington</strong>
              </p>
            </td>
          </tr>
          
        </table>
        
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                This is an automated notification from FBC Arlington Communications Team.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`
        });

        emailSent = true;
        emailSentAt = new Date().toISOString();
        console.log('✅ Intake email sent successfully to:', formData.requester_email);

      } catch (emailErr) {
        emailError = emailErr.message || 'Failed to send email';
        console.error('❌ Failed to send intake email:', emailError);
        console.error('Email error details:', emailErr);
      }

      await base44.entities.WorkflowRequest.update(request.id, {
        email_sent: emailSent,
        email_sent_at: emailSentAt,
        email_error: emailError
      });

      console.log('📊 Email tracking updated:', { emailSent, emailSentAt, emailError });

      if (emailSent) {
        toast.success("Request submitted! Check your email for next steps.");
      } else {
        toast.warning("Request submitted, but email notification failed. Please check the request details.");
      }

      setSubmitted(true);

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
                Check your email for a link to complete the intake interview. The interview takes about 5 minutes.
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

        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Project Details
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <div 
                className={`space-y-2 p-4 rounded-lg border-2 ${
                  validationErrors.is_event_related 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-blue-50 border-blue-200'
                }`}
                data-validation-error={!!validationErrors.is_event_related}
              >
                <Label className={`text-sm font-semibold ${
                  validationErrors.is_event_related ? 'text-red-900' : 'text-blue-900'
                }`}>
                  Is this related to an event? <span className="text-red-500">*</span>
                </Label>
                {validationErrors.is_event_related && (
                  <p className="text-sm text-red-600 font-medium">
                    ⚠️ {validationErrors.is_event_related}
                  </p>
                )}
                <RadioGroup
                  value={formData.is_event_related}
                  onValueChange={(value) => {
                    handleChange("is_event_related", value);
                    setValidationErrors(prev => ({ ...prev, is_event_related: undefined }));
                    if (value === "no") {
                      handleChange("event_source", "");
                      handleChange("pco_event_id", "");
                      handleChange("pco_event_name", "");
                      handleChange("pco_event_date", "");
                      setPcoEvents([]);
                      setEventSearchQuery("");
                      searchCacheRef.current.clear();
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

              <AnimatePresence>
                {formData.is_event_related === "yes" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pl-4 border-l-4 border-blue-300"
                  >
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Search PCO Calendar Event
                      </Label>
                      
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Type at least 3 characters to search..."
                          value={eventSearchQuery}
                          onChange={(e) => setEventSearchQuery(e.target.value)}
                          className="pl-10 h-10"
                        />
                        {searchingEvents && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-600" />
                        )}
                      </div>

                      {eventSearchQuery.length > 0 && eventSearchQuery.length < 3 && (
                        <p className="text-xs text-slate-500">
                          Type at least 3 characters to search events
                        </p>
                      )}

                      {searchError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">{searchError}</p>
                        </div>
                      )}

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

                      {!formData.pco_event_id && pcoEvents.length > 0 && (
                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                          <div className="divide-y">
                            {pcoEvents.map(event => (
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
                                {event.location && (
                                  <p className="text-xs text-slate-500 mt-1">{event.location}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!formData.pco_event_id && pcoEvents.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Showing {pcoEvents.length} event{pcoEvents.length !== 1 ? 's' : ''} (next 6 months)
                        </p>
                      )}
                    </div>

                    <div 
                      className="space-y-1.5"
                      data-validation-error={!!validationErrors.event_name}
                    >
                      <Label htmlFor="manual_event_name" className="text-sm font-medium">
                        Event Name {!formData.pco_event_id && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        id="manual_event_name"
                        value={formData.manual_event_name}
                        onChange={(e) => {
                          handleChange("manual_event_name", e.target.value);
                          setValidationErrors(prev => ({ ...prev, event_name: undefined }));
                        }}
                        placeholder="Enter event name if not found above"
                        required={formData.is_event_related === "yes" && !formData.pco_event_id}
                        className={`h-10 ${validationErrors.event_name ? 'border-red-500' : ''}`}
                      />
                      {validationErrors.event_name && (
                        <p className="text-sm text-red-600 font-medium">
                          ⚠️ {validationErrors.event_name}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        Type the event name if you can't find it in the search
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {formData.is_event_related === "no" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pl-4 border-l-4 border-green-300"
                  >
                    <div 
                      className="space-y-1.5"
                      data-validation-error={!!validationErrors.event_name}
                    >
                      <Label htmlFor="project_name" className="text-sm font-medium">
                        Project/Initiative Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="project_name"
                        value={formData.project_name}
                        onChange={(e) => {
                          handleChange("project_name", e.target.value);
                          setValidationErrors(prev => ({ ...prev, event_name: undefined }));
                        }}
                        placeholder="e.g., Fall Outreach Campaign"
                        required={formData.is_event_related === "no"}
                        className={`h-10 ${validationErrors.event_name ? 'border-red-500' : ''}`}
                      />
                      {validationErrors.event_name && (
                        <p className="text-sm text-red-600 font-medium">
                          ⚠️ {validationErrors.event_name}
                        </p>
                      )}
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

              {formData.is_event_related && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 pt-4 border-t"
                >
                  <div 
                    className="space-y-1.5"
                    data-validation-error={!!validationErrors.ministry_department}
                  >
                    <Label htmlFor="ministry_department" className="text-sm font-medium">
                      Ministry <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.ministry_department}
                      onValueChange={(value) => {
                        handleChange("ministry_department", value);
                        setValidationErrors(prev => ({ ...prev, ministry_department: undefined }));
                      }}
                      required
                    >
                      <SelectTrigger className={`h-10 ${validationErrors.ministry_department ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ministries.map(ministry => (
                          <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.ministry_department && (
                      <p className="text-sm text-red-600 font-medium">
                        ⚠️ {validationErrors.ministry_department}
                      </p>
                    )}
                  </div>

                  <div 
                    className={`space-y-2 p-4 rounded-lg border-2 ${
                      validationErrors.need_type 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-orange-50 border-orange-200'
                    }`}
                    data-validation-error={!!validationErrors.need_type}
                  >
                    <Label className={`text-sm font-semibold ${
                      validationErrors.need_type ? 'text-red-900' : 'text-orange-900'
                    }`}>
                      What do you need? <span className="text-red-500">*</span>
                    </Label>
                    {validationErrors.need_type && (
                      <p className="text-sm text-red-600 font-medium">
                        ⚠️ {validationErrors.need_type}
                      </p>
                    )}
                    <RadioGroup
                      value={formData.need_type}
                      onValueChange={(value) => {
                        handleChange("need_type", value);
                        setValidationErrors(prev => ({ ...prev, need_type: undefined }));
                      }}
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

                  <div 
                    className="space-y-2"
                    data-validation-error={!!validationErrors.event_date}
                  >
                    <Label className="text-sm font-medium">
                      Event Date & Time <span className="text-red-500">*</span>
                    </Label>
                    {validationErrors.event_date && (
                      <p className="text-sm text-red-600 font-medium">
                        ⚠️ {validationErrors.event_date}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`justify-start text-left font-normal h-10 ${
                              !selectedDate && "text-muted-foreground"
                            } ${validationErrors.event_date ? 'border-red-500' : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              setSelectedDate(date);
                              setValidationErrors(prev => ({ ...prev, event_date: undefined }));
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

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

                        <div className="space-y-3">
                          <Label className="text-sm font-medium">
                            Previous Event Photos (Optional)
                          </Label>
                          <p className="text-xs text-slate-500">
                            If you have pictures from previous events, you can share them here. If not, no worries!
                          </p>
                          
                          <RadioGroup
                            value={photoUploadMethod}
                            onValueChange={setPhotoUploadMethod}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="upload" id="photo-upload" />
                              <Label htmlFor="photo-upload" className="cursor-pointer font-normal flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Upload Files
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="link" id="photo-link" />
                              <Label htmlFor="photo-link" className="cursor-pointer font-normal flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" />
                                Paste Link
                              </Label>
                            </div>
                          </RadioGroup>

                          {photoUploadMethod === "upload" ? (
                            <Input
                              id="previous_photos"
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="h-10"
                            />
                          ) : (
                            <Input
                              id="previous_photos_link"
                              value={formData.previous_event_photos_link}
                              onChange={(e) => handleChange("previous_event_photos_link", e.target.value)}
                              placeholder="Paste link to Google Drive, Dropbox, etc..."
                              className="h-10"
                            />
                          )}
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

                  {formData.need_type && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pt-4"
                    >
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
                    </motion.div>
                  )}
                </motion.div>
              )}
            </form>
          </CardContent>
        </Card>

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