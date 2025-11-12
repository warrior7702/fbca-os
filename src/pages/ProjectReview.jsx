
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
  Plus,
  Upload,
  X,
  Camera,
  Trash2,
  Edit2,
  ChevronLeft, // Added
  ChevronRight // Added
} from "lucide-react";
import { 
  format, 
  subDays, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval 
} from "date-fns"; // Added date-fns imports
import { toast } from "sonner";

export default function ProjectReview() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('id');
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedMaterials, setUploadedMaterials] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Added
  const [draggedTask, setDraggedTask] = useState(null); // Added

  // Project details form
  const [projectDetails, setProjectDetails] = useState({
    project_name: '',
    ministry_area: '',
    request_type: '',
    event_date: '',
    registration_link: '',
    target_audience: '',
    key_message: '',
    event_theme: '',
    materials_for_attendees: '',
    what_makes_special: '',
    desired_impact: '',
    childcare_details: '',
    food_menu: '',
    event_flow: '',
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
        const projectData = foundRequest.project_review_data || {};
        
        setProjectDetails({
          project_name: foundRequest.title || '',
          ministry_area: foundRequest.ministry_department || '',
          request_type: goalData.need_type || '',
          event_date: foundRequest.pco_event_date || goalData.event_date || '',
          event_theme: goalData.event_theme || '',
          expected_attendance: goalData.expected_attendance || '',
          materials_for_attendees: goalData.materials_for_attendees || '',
          what_makes_special: goalData.what_makes_special || '',
          desired_impact: goalData.desired_impact || '',
          childcare_details: goalData.childcare_details || '',
          food_menu: goalData.food_menu || '',
          event_flow: goalData.event_flow || '',
          special_notes: goalData.special_notes || '',
          registration_link: goalData.registration_link || '',
          target_audience: goalData.target_audience || '',
          key_message: goalData.key_message || '',
          design_items: goalData.deliverables || [],
        });
        
        // Load uploaded materials
        setUploadedMaterials(projectData.uploaded_materials || []);

        // Load or auto-generate tasks
        if (projectData.tasks && projectData.tasks.length > 0) {
          setTasks(projectData.tasks);
        } else {
          // Auto-generate tasks based on event date
          const eventDate = foundRequest.pco_event_date || goalData.event_date;
          if (eventDate) {
            const autoTasks = generateAutoTasks(eventDate, foundRequest.title);
            setTasks(autoTasks);
            
            // Set calendar to event month
            setCurrentMonth(new Date(eventDate));
          }
        }
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

  const generateAutoTasks = (eventDate, projectName) => {
    const eventDateObj = new Date(eventDate);
    
    // Find the Sunday before the event
    const sundayBefore = new Date(eventDateObj);
    while (sundayBefore.getDay() !== 0) {
      sundayBefore.setDate(sundayBefore.getDate() - 1);
    }
    
    return [
      {
        id: `task-${Date.now()}-1`,
        name: `Graphics for ${projectName}`,
        type: 'graphics',
        due_date: subDays(eventDateObj, 14).toISOString(),
        assigned_to: 'Shelby Meeks',
        status: 'not_started',
        description: 'Create all graphic design assets for this event',
        color: 'pink' // Added color
      },
      {
        id: `task-${Date.now()}-2`,
        name: 'Pulpit Announcement',
        type: 'pulpit_announcement',
        due_date: sundayBefore.toISOString(),
        assigned_to: 'Kyle Judkins',
        status: 'not_started',
        description: 'Prepare and deliver pulpit announcement',
        color: 'pink' // Added color
      },
      {
        id: `task-${Date.now()}-3`,
        name: 'Social Media Reel #1',
        type: 'social_media',
        due_date: subDays(eventDateObj, 10).toISOString(),
        assigned_to: 'Kyle Judkins',
        status: 'not_started',
        description: 'Create first promotional reel for social media',
        color: 'orange' // Added color
      },
      {
        id: `task-${Date.now()}-4`,
        name: 'Social Media Reel #2',
        type: 'social_media',
        due_date: subDays(eventDateObj, 5).toISOString(),
        assigned_to: 'Kyle Judkins',
        status: 'not_started',
        description: 'Create second promotional reel for social media',
        color: 'orange' // Added color
      },
      {
        id: `task-${Date.now()}-5`,
        name: 'Digital Signs Go Live',
        type: 'digital_signs',
        due_date: subDays(eventDateObj, 14).toISOString(),
        assigned_to: 'Kyle Judkins',
        status: 'not_started',
        description: 'Launch digital signage campaign',
        color: 'blue' // Added color
      }
    ];
  };

  const addPhotographerTask = () => {
    const eventDate = request.pco_event_date || request.goal_review_data?.event_date;
    if (!eventDate) {
      toast.error('Event date required to add photographer task');
      return;
    }

    const newTask = {
      id: `task-${Date.now()}-photographer`,
      name: 'Event Photography',
      type: 'photography',
      due_date: new Date(eventDate).toISOString(),
      assigned_to: 'Volunteer Photographer',
      status: 'not_started',
      description: 'Capture photos during the event',
      color: 'purple' // Added color
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    toast.success('Photographer task added');
  };

  const addSocialMediaReel = () => { // Added function
    const eventDate = request.pco_event_date || request.goal_review_data?.event_date;
    if (!eventDate) {
      toast.error('Event date required to add task');
      return;
    }

    const newTask = {
      id: `task-${Date.now()}-reel-${Math.random()}`,
      name: 'Social Media Reel',
      type: 'social_media',
      due_date: subDays(new Date(eventDate), 7).toISOString(),
      assigned_to: 'Kyle Judkins',
      status: 'not_started',
      description: 'Create promotional reel for social media',
      color: 'orange'
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    toast.success('Social Media Reel task added');
  };

  const updateTaskDate = (taskId, newDate) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, due_date: new Date(newDate).toISOString() } : task
    );
    setTasks(updatedTasks);
  };

  const updateTaskStatus = (taskId) => {
    const statusFlow = ['not_started', 'in_progress', 'completed'];
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const currentIndex = statusFlow.indexOf(task.status);
        const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];
        return { ...task, status: nextStatus };
      }
      return task;
    });
    setTasks(updatedTasks);
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    toast.success('Task deleted');
  };

  const getTaskColor = (task) => { // Modified from getStatusColor
    const colors = {
      pink: 'border-pink-300 bg-pink-50 text-pink-700',
      blue: 'border-blue-300 bg-blue-50 text-blue-700',
      orange: 'border-orange-300 bg-orange-50 text-orange-700',
      purple: 'border-purple-300 bg-purple-50 text-purple-700'
    };
    return colors[task.color] || 'border-slate-300 bg-slate-50 text-slate-700';
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedFiles = [];
      
      for (const file of files) {
        const result = await base44.integrations.Core.UploadFile({ file });
        uploadedFiles.push({
          name: file.name,
          url: result.file_url,
          uploaded_at: new Date().toISOString(),
          uploaded_by: request.requestor_name
        });
      }

      const newMaterials = [...uploadedMaterials, ...uploadedFiles];
      setUploadedMaterials(newMaterials);

      // Save to database
      await base44.entities.WorkflowRequest.update(requestId, {
        project_review_data: {
          ...request.project_review_data,
          uploaded_materials: newMaterials
        }
      });

      toast.success(`${uploadedFiles.length} file(s) uploaded!`);
      await loadRequest();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveMaterial = async (index) => {
    const newMaterials = uploadedMaterials.filter((_, idx) => idx !== index);
    setUploadedMaterials(newMaterials);

    try {
      await base44.entities.WorkflowRequest.update(requestId, {
        project_review_data: {
          ...request.project_review_data,
          uploaded_materials: newMaterials
        }
      });
      toast.success('Material removed');
      await loadRequest();
    } catch (error) {
      console.error('Error removing material:', error);
      toast.error('Failed to remove material');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.WorkflowRequest.update(requestId, {
        project_review_data: {
          ...request.project_review_data,
          ...projectDetails,
          tasks: tasks,
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
      // Create tickets for each task
      const ticketPromises = tasks.map(async (task) => {
        const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
        
        return base44.entities.Ticket.create({
          ticket_number: ticketNumber,
          subject: task.name,
          description: task.description || `Task for ${request.title}`,
          status: 'open',
          priority: 'medium',
          category: task.type === 'graphics' ? 'marketing' : 
                   task.type === 'social_media' ? 'marketing' :
                   task.type === 'photography' ? 'av_production' : 'other',
          requester_email: request.requestor_email,
          requester_name: request.requestor_name,
          assigned_to_name: task.assigned_to,
          source: 'communications_workflow',
          related_event_id: request.pco_event_id,
          tags: [request.ministry_department, 'communications', task.type],
          comments: [{
            author_email: request.requestor_email,
            author_name: request.requestor_name,
            content: `Auto-created from Communications Request: ${request.request_number}`,
            is_internal: false,
            timestamp: new Date().toISOString()
          }]
        });
      });

      await Promise.all(ticketPromises);

      // Update workflow request status
      await base44.entities.WorkflowRequest.update(requestId, {
        status: 'campaign_running',
        project_review_data: {
          ...request.project_review_data,
          ...projectDetails,
          tasks: tasks,
          reviewed_at: new Date().toISOString(),
          tickets_created: true,
          tickets_created_at: new Date().toISOString()
        }
      });

      toast.success(`✅ Project finalized! ${tasks.length} support tickets created for your team.`);
      navigate(createPageUrl('WorkflowHub'));
    } catch (error) {
      console.error('Error finalizing:', error);
      toast.error('Failed to finalize project');
    } finally {
      setSaving(false);
    }
  };

  // Calendar rendering logic - Added function
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks = [];
    let week = [];

    dateRange.forEach((day, i) => {
      week.push(day);
      if ((i + 1) % 7 === 0) {
        weeks.push(week);
        week = [];
      }
    });

    const eventDate = request?.pco_event_date || request?.goal_review_data?.event_date;

    return (
      <div className="bg-purple-50 rounded-lg p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-2">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIdx) => {
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isEventDay = eventDate && isSameDay(day, new Date(eventDate));
                const dayTasks = tasks.filter(task => 
                  isSameDay(new Date(task.due_date), day)
                );

                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[100px] border-2 rounded-lg p-2 transition-colors ${
                      isCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'
                    } ${isEventDay ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-300' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTask) {
                        updateTaskDate(draggedTask.id, day.toISOString());
                        setDraggedTask(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${
                        isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {isEventDay && (
                        <Badge className="bg-purple-600 text-white text-xs">EVENT</Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayTasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggedTask(task)}
                          onDragEnd={() => setDraggedTask(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTaskStatus(task.id);
                          }}
                          className={`text-xs p-1.5 rounded border-2 cursor-move hover:shadow-md transition-all ${getTaskColor(task)} ${
                            task.status === 'completed' ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          <div className="font-medium truncate">{task.name}</div>
                          <div className="text-[10px] opacity-75 truncate">{task.assigned_to}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
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

  const eventDate = request.pco_event_date || request.goal_review_data?.event_date;

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
                  Upload logos, photos, brand assets, or documents for this project
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Upload Section */}
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Upload Materials</h3>
                      <p className="text-sm text-slate-600">
                        Upload logos, photos, brand guidelines, or other assets
                      </p>
                    </div>
                    <label htmlFor="file-upload">
                      <Button
                        type="button"
                        disabled={uploading}
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => document.getElementById('file-upload').click()}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Files
                          </>
                        )}
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-amber-600 text-lg">💡</span>
                      <h4 className="font-semibold text-amber-900 text-sm">Helpful Materials:</h4>
                    </div>
                    <ul className="space-y-1 text-xs text-amber-800">
                      <li>• Ministry/Event logos (current versions)</li>
                      <li>• Previous event photos for reference</li>
                      <li>• Brand guidelines or style guides</li>
                      <li>• Approved color palettes or fonts</li>
                    </ul>
                  </div>
                </div>

                {/* Uploaded Files */}
                {uploadedMaterials.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Uploaded Files</h3>
                    <div className="space-y-2">
                      {uploadedMaterials.map((material, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Image className="w-5 h-5 text-purple-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-slate-900 truncate">{material.name}</p>
                              <p className="text-xs text-slate-500">
                                Uploaded {format(new Date(material.uploaded_at), 'MMM d, yyyy')}
                                {material.uploaded_by && ` by ${material.uploaded_by}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={material.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              View
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveMaterial(idx)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Links from Intake */}
                {(request.goal_review_data?.graphics_folder_link || 
                  request.goal_review_data?.marketing_assets_link || 
                  request.goal_review_data?.previous_event_photos) && (
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Links from Intake Form</h3>
                    <div className="space-y-3">
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
                    </div>
                  </div>
                )}

                {/* Empty State - only show if no uploaded materials AND no links */}
                {uploadedMaterials.length === 0 && 
                 !request.goal_review_data?.graphics_folder_link && 
                 !request.goal_review_data?.marketing_assets_link && 
                 !request.goal_review_data?.previous_event_photos && (
                  <div className="text-center py-8">
                    <LinkIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">
                      No materials uploaded yet. Use the upload button above to add files.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline & Tasks Tab */}
          <TabsContent value="timeline" className="space-y-6">
            {/* Auto-Assignment Info */}
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-green-900 text-lg mb-2">AUTO-ASSIGNMENT ENABLED</h3>
                  <p className="text-sm text-green-800 mb-3">
                    Tasks are automatically assigned to your team based on their roles:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
                    <div>• Graphics/Design → <strong>Shelby Meeks</strong></div>
                    <div>• Social Media Reels → <strong>Kyle Judkins</strong></div>
                    <div>• Pulpit Announcement → <strong>Kyle Judkins</strong></div>
                    <div>• Digital Signs → <strong>Kyle Judkins</strong></div>
                    <div>• Photography (optional) → <strong>Volunteer Photographer</strong></div>
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
                      {eventDate ? (
                        <>
                          Event Date: <strong>{format(new Date(eventDate), 'MMMM d, yyyy')}</strong>
                        </>
                      ) : (
                        'Set event date to see timeline'
                      )}
                    </p>
                  </div>
                  {eventDate && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <Clock className="w-3 h-3 mr-1" />
                      {(() => {
                        const today = new Date();
                        const event = new Date(eventDate);
                        const daysUntil = Math.ceil((event - today) / (1000 * 60 * 60 * 24));
                        return daysUntil > 0 ? `${daysUntil} days until event` : 'Event passed';
                      })()}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Quick Add Common Tasks */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Quick Add Common Tasks:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={addPhotographerTask}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      Photographer (Event Day)
                    </Button>
                    <Button
                      onClick={addSocialMediaReel} // New button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      Social Media Reel
                    </Button>
                  </div>
                </div>

                {/* Calendar */}
                {renderCalendar()}

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 text-sm mb-3">How to use:</h4>
                  <ul className="space-y-1.5 text-xs text-blue-800">
                    <li>• <strong>Calendar auto-adjusts</strong> to show from your first task to the event date</li>
                    <li>• <strong>Drag and drop</strong> your project's tasks to move them to different dates</li>
                    <li>• <strong>Click</strong> on a task to cycle through: Not Started → In Progress → Complete</li>
                    <li>• <strong>Solid colored tasks</strong> are your project's tasks - fully editable</li>
                    <li>• <strong>Use this view</strong> to avoid scheduling conflicts and balance the team's workload</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Finalize Notice */}
            {tasks.length > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg mb-2">Ready to Launch?</h3>
                    <p className="text-sm text-blue-800 mb-4">
                      When you click "Finalize & Start Campaign", these {tasks.length} tasks will be automatically created as support tickets in your ticketing system, assigned to the team members shown above.
                    </p>
                    <p className="text-xs text-blue-700">
                      Each ticket will include the task details, due dates, and be linked back to this communications request for tracking.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
