
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  FileText,
  CheckCircle2,
  Save,
  ArrowRight,
  Calendar as CalendarIcon,
  Users,
  MessageSquare,
  Link as LinkIcon,
  Image,
  Play,
  Clock,
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ProjectReview() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('id');
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Project details form
  const [projectDetails, setProjectDetails] = useState({
    project_name: '',
    ministry_area: '',
    request_type: '',
    event_date: '',
    registration_link: '',
    target_audience: '',
    key_message: '',
    event_theme: '', // NEW
    materials_for_attendees: '', // NEW
    what_makes_special: '', // NEW
    desired_impact: '', // NEW
    childcare_details: '', // NEW
    food_menu: '', // NEW
    event_flow: '', // NEW
    design_items: [],
    expected_attendance: '',
    special_notes: ''
  });

  useEffect(() => {
    if (requestId) {
      loadRequest();
    }
  }, [requestId]);

  const loadRequest = async () => {
    setLoading(true);
    try {
      const req = await base44.entities.WorkflowRequest.filter({ id: requestId });
      if (req && req.length > 0) {
        const foundRequest = req[0];
        setRequest(foundRequest);

        // Pre-populate from goal review data
        const goalData = foundRequest.goal_review_data || {};
        setProjectDetails({
          project_name: foundRequest.title || '',
          ministry_area: foundRequest.ministry_department || '',
          request_type: goalData.need_type || '',
          event_date: foundRequest.pco_event_date || goalData.event_date || '',
          event_theme: goalData.event_theme || '', // NEW
          expected_attendance: goalData.expected_attendance || '',
          materials_for_attendees: goalData.materials_for_attendees || '', // NEW
          what_makes_special: goalData.what_makes_special || '', // NEW
          desired_impact: goalData.desired_impact || '', // NEW
          childcare_details: goalData.childcare_details || '', // NEW
          food_menu: goalData.food_menu || '', // NEW
          event_flow: goalData.event_flow || '', // NEW
          special_notes: goalData.special_notes || '',
          registration_link: goalData.registration_link || '',
          target_audience: goalData.target_audience || '',
          key_message: goalData.key_message || '',
          design_items: goalData.deliverables || [],
        });
      } else {
        toast.error('Request not found');
        navigate(createPageUrl('WorkflowHub'));
      }
    } catch (error) {
      console.error('Error loading request:', error);
      toast.error('Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.WorkflowRequest.update(requestId, {
        project_review_data: {
          ...projectDetails,
          reviewed_at: new Date().toISOString()
        }
      });
      toast.success('Project details saved');
      await loadRequest();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      await base44.entities.WorkflowRequest.update(requestId, {
        status: 'campaign_running',
        project_review_data: {
          ...projectDetails,
          reviewed_at: new Date().toISOString()
        }
      });
      toast.success('Project finalized and campaign started');
      navigate(createPageUrl('WorkflowHub'));
    } catch (error) {
      console.error('Error finalizing:', error);
      toast.error('Failed to finalize');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('WorkflowHub'))}
              >
                ← Back
              </Button>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">
              PROJECT REVIEW & PLANNING
            </h1>
            <p className="text-sm text-slate-600">{request.title}</p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Plan
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Finalize & Start Campaign
            </Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="interview">Interview Summary</TabsTrigger>
            <TabsTrigger value="materials">Linked Materials</TabsTrigger>
            <TabsTrigger value="timeline">Timeline & Tasks</TabsTrigger>
          </TabsList>

          {/* Project Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Edit Project Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Project Name
                    </label>
                    <Input
                      value={projectDetails.project_name}
                      onChange={(e) => setProjectDetails({...projectDetails, project_name: e.target.value})}
                      placeholder="Enter project name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Ministry Area
                    </label>
                    <Input
                      value={projectDetails.ministry_area}
                      onChange={(e) => setProjectDetails({...projectDetails, ministry_area: e.target.value})}
                      placeholder="e.g., College, Youth Ministry"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Request Type
                    </label>
                    <Input
                      value={projectDetails.request_type}
                      onChange={(e) => setProjectDetails({...projectDetails, request_type: e.target.value})}
                      placeholder="Graphics, Marketing, or Both"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Event Date & Time
                    </label>
                    <Input
                      type="text"
                      value={projectDetails.event_date}
                      onChange={(e) => setProjectDetails({...projectDetails, event_date: e.target.value})}
                      placeholder="e.g., Jan 1, 2024 7:00 PM"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Event Theme
                  </label>
                  <Input
                    value={projectDetails.event_theme}
                    onChange={(e) => setProjectDetails({...projectDetails, event_theme: e.target.value})}
                    placeholder="Main theme of the event"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Expected Attendance
                    </label>
                    <Input
                      value={projectDetails.expected_attendance}
                      onChange={(e) => setProjectDetails({...projectDetails, expected_attendance: e.target.value})}
                      placeholder="How many people"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Website or Registration Link
                    </label>
                    <Input
                      value={projectDetails.registration_link}
                      onChange={(e) => setProjectDetails({...projectDetails, registration_link: e.target.value})}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Materials for Attendees
                  </label>
                  <Textarea
                    value={projectDetails.materials_for_attendees}
                    onChange={(e) => setProjectDetails({...projectDetails, materials_for_attendees: e.target.value})}
                    placeholder="What items are you giving to attendees?"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    What Makes This Special
                  </label>
                  <Textarea
                    value={projectDetails.what_makes_special}
                    onChange={(e) => setProjectDetails({...projectDetails, what_makes_special: e.target.value})}
                    placeholder="What sets this program apart from others?"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Desired Impact (Spiritual, Emotional, Relational)
                  </label>
                  <Textarea
                    value={projectDetails.desired_impact}
                    onChange={(e) => setProjectDetails({...projectDetails, desired_impact: e.target.value})}
                    placeholder="What should attendees leave with?"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Childcare Details
                    </label>
                    <Input
                      value={projectDetails.childcare_details}
                      onChange={(e) => setProjectDetails({...projectDetails, childcare_details: e.target.value})}
                      placeholder="Provided, included, or alternate programming?"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Food / Menu
                    </label>
                    <Input
                      value={projectDetails.food_menu}
                      onChange={(e) => setProjectDetails({...projectDetails, food_menu: e.target.value})}
                      placeholder="What's the menu?"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Event Flow / Speakers / Topics
                  </label>
                  <Textarea
                    value={projectDetails.event_flow}
                    onChange={(e) => setProjectDetails({...projectDetails, event_flow: e.target.value})}
                    placeholder="Event logistics and flow"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Special Notes
                  </label>
                  <Textarea
                    value={projectDetails.special_notes}
                    onChange={(e) => setProjectDetails({...projectDetails, special_notes: e.target.value})}
                    placeholder="Any other specific information"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Design Items Requested
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {request.goal_review_data?.graphics_items && Object.entries(request.goal_review_data.graphics_items)
                      .filter(([_, value]) => value)
                      .map(([key, _]) => (
                        <Badge key={key} variant="outline" className="justify-start">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                          {key.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interview Summary Tab */}
          <TabsContent value="interview" className="space-y-6">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Interview Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {request.goal_review_data?.chat_history && request.goal_review_data.chat_history.length > 0 ? (
                  <div className="space-y-4">
                    {request.goal_review_data.chat_history.map((message, idx) => (
                      <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                          message.role === 'user' 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-100 text-slate-900'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No interview data available</p>
                )}
              </CardContent>
            </Card>

            {/* Extracted Data Summary */}
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Collected Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {projectDetails.target_audience && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Target Audience</p>
                      <p className="text-sm text-slate-900">{projectDetails.target_audience}</p>
                    </div>
                  )}
                  {projectDetails.key_message && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Key Message</p>
                      <p className="text-sm text-slate-900">{projectDetails.key_message}</p>
                    </div>
                  )}
                  {projectDetails.event_theme && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Event Theme</p>
                      <p className="text-sm text-slate-900">{projectDetails.event_theme}</p>
                    </div>
                  )}
                  {projectDetails.expected_attendance && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Expected Attendance</p>
                      <p className="text-sm text-slate-900">{projectDetails.expected_attendance}</p>
                    </div>
                  )}
                  {projectDetails.materials_for_attendees && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Materials for Attendees</p>
                      <p className="text-sm text-slate-900">{projectDetails.materials_for_attendees}</p>
                    </div>
                  )}
                  {projectDetails.what_makes_special && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">What Makes It Special</p>
                      <p className="text-sm text-slate-900">{projectDetails.what_makes_special}</p>
                    </div>
                  )}
                  {projectDetails.desired_impact && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Desired Impact</p>
                      <p className="text-sm text-slate-900">{projectDetails.desired_impact}</p>
                    </div>
                  )}
                  {projectDetails.childcare_details && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Childcare</p>
                      <p className="text-sm text-slate-900">{projectDetails.childcare_details}</p>
                    </div>
                  )}
                  {projectDetails.food_menu && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Food / Menu</p>
                      <p className="text-sm text-slate-900">{projectDetails.food_menu}</p>
                    </div>
                  )}
                  {projectDetails.event_flow && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Event Flow / Speakers / Topics</p>
                      <p className="text-sm text-slate-900">{projectDetails.event_flow}</p>
                    </div>
                  )}
                  {projectDetails.special_notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Special Notes</p>
                      <p className="text-sm text-slate-900">{projectDetails.special_notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linked Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Linked Materials</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {request.goal_review_data?.graphics_folder_link && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <LinkIcon className="w-4 h-4 text-slate-600" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Graphics Folder</p>
                      <a 
                        href={request.goal_review_data.graphics_folder_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {request.goal_review_data.graphics_folder_link}
                      </a>
                    </div>
                  </div>
                )}

                {request.goal_review_data?.marketing_assets_link && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <LinkIcon className="w-4 h-4 text-slate-600" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Marketing Assets</p>
                      <a 
                        href={request.goal_review_data.marketing_assets_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {request.goal_review_data.marketing_assets_link}
                      </a>
                    </div>
                  </div>
                )}

                {request.goal_review_data?.previous_event_photos && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-2">Previous Event Photos</p>
                    <div className="flex gap-2 flex-wrap">
                      {Array.isArray(request.goal_review_data.previous_event_photos) 
                        ? request.goal_review_data.previous_event_photos.map((url, idx) => (
                          <a 
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Photo {idx + 1}
                          </a>
                        ))
                        : (
                          <a 
                            href={request.goal_review_data.previous_event_photos}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Photos
                          </a>
                        )}
                    </div>
                  </div>
                )}

                {!request.goal_review_data?.graphics_folder_link && 
                 !request.goal_review_data?.marketing_assets_link && 
                 !request.goal_review_data?.previous_event_photos && (
                  <p className="text-sm text-slate-500 text-center py-8">No materials linked</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline & Tasks Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Timeline & Tasks</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-4">Task automation coming soon</p>
                  <p className="text-xs text-slate-400">
                    Automatic ClickUp integration will create tasks based on project details
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
