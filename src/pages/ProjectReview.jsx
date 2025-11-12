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
  Building2,
  Sparkles,
  Plus
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
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Interview Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {request.goal_review_data?.event_theme || 
                 request.goal_review_data?.expected_attendance || 
                 request.goal_review_data?.desired_impact ? (
                  <>
                    {request.goal_review_data.event_theme && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Main Goal & Purpose</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.event_theme}</p>
                      </div>
                    )}

                    {request.goal_review_data.expected_attendance && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Expected Attendance</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.expected_attendance}</p>
                      </div>
                    )}

                    {request.goal_review_data.desired_impact && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Desired Outcome</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.desired_impact}</p>
                      </div>
                    )}

                    {request.goal_review_data.what_makes_special && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">What Makes This Special</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.what_makes_special}</p>
                      </div>
                    )}

                    {request.goal_review_data.event_flow && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Event Logistics & Flow</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.event_flow}</p>
                      </div>
                    )}

                    {request.goal_review_data.materials_for_attendees && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Materials Provided to Attendees</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.materials_for_attendees}</p>
                      </div>
                    )}

                    {request.goal_review_data.food_menu && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Food & Refreshments</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.food_menu}</p>
                      </div>
                    )}

                    {request.goal_review_data.childcare_details && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">Childcare Information</h3>
                        <p className="text-slate-700 leading-relaxed">{request.goal_review_data.childcare_details}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No interview insights available yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linked Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-purple-600" />
                  Linked Materials
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Add existing logos, photos, brand assets, or documents that should be used for this project
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {!request.goal_review_data?.graphics_folder_link && 
                 !request.goal_review_data?.marketing_assets_link && 
                 !request.goal_review_data?.previous_event_photos ? (
                  <div className="text-center py-12">
                    <div className="mb-6">
                      <LinkIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 mb-6">
                        No materials linked yet. Add existing logos, brand guidelines, photos, or other assets that should be used for this project.
                      </p>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-left max-w-xl mx-auto">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-amber-600 text-lg">💡</span>
                        <h3 className="font-semibold text-amber-900">Helpful Materials to Include:</h3>
                      </div>
                      <ul className="space-y-2 text-sm text-amber-800">
                        <li>• Ministry/Event logos (current versions)</li>
                        <li>• Previous event photos for reference</li>
                        <li>• Brand guidelines or style guides</li>
                        <li>• Approved color palettes or fonts</li>
                        <li>• Existing copy, scripts, or promotional text</li>
                        <li>• Contact information for key stakeholders</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    {request.goal_review_data?.graphics_folder_link && (
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <LinkIcon className="w-5 h-5 text-purple-600" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-700 mb-1">Graphics Folder</p>
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
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <LinkIcon className="w-5 h-5 text-purple-600" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-700 mb-1">Marketing Assets</p>
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
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-3">Previous Event Photos</p>
                        <div className="flex gap-2 flex-wrap">
                          {Array.isArray(request.goal_review_data.previous_event_photos) 
                            ? request.goal_review_data.previous_event_photos.map((url, idx) => (
                              <a 
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Photo {idx + 1}
                              </a>
                            ))
                            : (
                              <a 
                                href={request.goal_review_data.previous_event_photos}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                View Photos
                              </a>
                            )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline & Tasks Tab */}
          <TabsContent value="timeline" className="space-y-6">
            {/* Auto-Assignment Section */}
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-green-900 text-lg mb-2">AUTO-ASSIGNMENT ENABLED</h3>
                  <p className="text-sm text-green-800 mb-4">Tasks are automatically assigned to your team based on their roles.</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">•</span>
                      <span className="text-green-900">Graphics/Design → <strong>Shelby Meeks</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">•</span>
                      <span className="text-green-900">Social Media Reels → <strong>Kyle Judkins</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">•</span>
                      <span className="text-green-900">Video Content → <strong>Addyson Mitchell</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">•</span>
                      <span className="text-green-900">Photography → <strong>Volunteer Photographer</strong> (backup: Addyson)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">•</span>
                      <span className="text-green-900">AV/Lighting → <strong>Zack Barton</strong> (backup: Kyle)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Timeline */}
            <Card>
              <CardHeader className="border-b bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-purple-600" />
                      Project Timeline
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      Showing Nov 8 - Nov 25, 2025
                      {projectDetails.event_date && (
                        <span className="ml-2">
                          • Event Date: <strong>{format(new Date(projectDetails.event_date), 'MMMM d, yyyy')}</strong>
                        </span>
                      )}
                    </p>
                  </div>
                  {projectDetails.event_date && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <Clock className="w-3 h-3 mr-1" />
                      {(() => {
                        const eventDate = new Date(projectDetails.event_date);
                        const today = new Date();
                        const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                        return daysUntil > 0 ? `${daysUntil} days until event` : 'Event passed';
                      })()}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Add Task Input */}
                <div className="mb-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add custom task..."
                      className="flex-1"
                    />
                    <Button className="bg-slate-900 hover:bg-slate-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                  
                  {/* Quick Add Common Tasks */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Quick Add Common Tasks:</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" className="text-xs">
                        <Plus className="w-3 h-3 mr-1" />
                        Photographer (Event Day)
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Plus className="w-3 h-3 mr-1" />
                        Social Media Reel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Coming Soon Calendar Placeholder */}
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 mb-2">Interactive Calendar Coming Soon</p>
                  <p className="text-xs text-slate-500 mb-4">
                    Full calendar view with drag-and-drop task scheduling, color-coded tasks, and timeline visualization
                  </p>
                  
                  {/* Instructions Preview */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-2xl mx-auto mt-6">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-blue-600 text-lg">💡</span>
                      <h4 className="font-semibold text-blue-900 text-sm">How to use (when ready):</h4>
                    </div>
                    <ul className="space-y-1.5 text-xs text-blue-800">
                      <li>• <strong>Calendar auto-adjusts</strong> to show from your first task to the event date</li>
                      <li>• <strong>Drag and drop</strong> your project's tasks to move them to different dates</li>
                      <li>• <strong>Click</strong> on a task to cycle through: Not Started → In Progress → Complete</li>
                      <li>• <strong>Hover</strong> over a task and click the trash icon to delete it</li>
                      <li>• <strong>Solid colored tasks</strong> are your project's tasks - fully editable</li>
                      <li>• <strong>Grey dashed tasks</strong> are from other projects - shown for workload visibility</li>
                      <li>• <strong>Use this view</strong> to avoid scheduling conflicts and balance the team's workload</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}