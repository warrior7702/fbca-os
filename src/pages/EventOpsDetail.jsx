import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Loader2,
  User,
  Plus,
  Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

export default function EventOpsDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);

  useEffect(() => {
    if (eventId) {
      loadEventDetails();
    }
  }, [eventId]);

  const loadEventDetails = async () => {
    setLoading(true);
    try {
      // Load event
      const events = await base44.entities.PCO_Event.filter({ pco_event_id: eventId });
      if (!events || events.length === 0) {
        toast.error('Event not found');
        navigate(-1);
        return;
      }
      const eventData = events[0];
      setEvent(eventData);

      // Load rooms
      const roomsData = await base44.entities.PCO_EventRoom.filter({ pco_event_id: eventId });
      setRooms(roomsData);

      // Load approvals
      const approvalsData = await base44.entities.PCO_EventApprovalRequest.filter({ pco_event_id: eventId });
      setApprovals(approvalsData);

      // Load tasks
      const tasksData = await base44.entities.EventOpsTask.filter({ pco_event_id: eventId });
      setTasks(tasksData);

      // Calculate timeline
      const calculatedTimeline = await calculateTimeline(eventData);
      setTimeline(calculatedTimeline);

      // Load staff for assignment
      const users = await base44.entities.User.list();
      setStaffMembers(users);

      // Auto-generate tasks if none exist
      if (tasksData.length === 0) {
        await generateTasks(eventData, approvalsData, calculatedTimeline);
      }

    } catch (error) {
      console.error('Error loading event details:', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeline = async (eventData) => {
    // Load config defaults
    let setupHoursBefore = 4;
    let maintenanceDaysBefore = 3;
    let cleaningHoursAfter = 2;

    try {
      const configs = await base44.entities.IntegrationConfig.filter({ category: 'event_ops_timeline' });
      configs.forEach(config => {
        if (config.key === 'SETUP_HOURS_BEFORE') setupHoursBefore = parseInt(config.value);
        if (config.key === 'MAINTENANCE_DAYS_BEFORE') maintenanceDaysBefore = parseInt(config.value);
        if (config.key === 'CLEANING_HOURS_AFTER') cleaningHoursAfter = parseInt(config.value);
      });
    } catch (err) {
      console.warn('Using default timeline values');
    }

    const eventStart = new Date(eventData.starts_at);
    const eventEnd = new Date(eventData.ends_at);

    const setupStart = new Date(eventStart.getTime() - setupHoursBefore * 60 * 60 * 1000);
    const maintenanceStart = new Date(eventStart.getTime() - maintenanceDaysBefore * 24 * 60 * 60 * 1000);
    const cleaningDue = new Date(eventEnd.getTime() + cleaningHoursAfter * 60 * 60 * 1000);

    return {
      setupWindow: {
        start: setupStart,
        end: eventStart,
        label: 'Setup Window'
      },
      maintenanceWindow: {
        start: maintenanceStart,
        end: eventStart,
        label: 'Maintenance Window'
      },
      cleaningWindow: {
        start: eventEnd,
        end: cleaningDue,
        label: 'Cleaning Due'
      }
    };
  };

  const generateTasks = async (eventData, approvalsData, calculatedTimeline) => {
    const generatedTasks = [];

    // Generate tasks from Room Setups approval
    const roomSetupsApproval = approvalsData.find(a => a.approval_group === 'Room Setups');
    if (roomSetupsApproval && roomSetupsApproval.answers) {
      const answers = roomSetupsApproval.answers;
      
      generatedTasks.push({
        pco_event_id: eventId,
        approval_group: 'Room Setups',
        task_name: 'Complete room setup per specifications',
        due_at: calculatedTimeline.setupWindow.end.toISOString(),
        status: 'todo',
        notes: `Setup details:\n${Object.entries(answers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}`
      });
    }

    // Generate tasks from Maintenance approval
    const maintenanceApproval = approvalsData.find(a => a.approval_group === 'Maintenance');
    if (maintenanceApproval && maintenanceApproval.answers) {
      const answers = maintenanceApproval.answers;
      
      generatedTasks.push({
        pco_event_id: eventId,
        approval_group: 'Maintenance',
        task_name: 'Complete maintenance requests',
        due_at: calculatedTimeline.maintenanceWindow.end.toISOString(),
        status: 'todo',
        notes: `Maintenance details:\n${Object.entries(answers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}`
      });
    }

    // Create tasks in database
    for (const task of generatedTasks) {
      try {
        await base44.entities.EventOpsTask.create(task);
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    if (generatedTasks.length > 0) {
      toast.success(`Generated ${generatedTasks.length} tasks`);
      // Reload tasks
      const tasksData = await base44.entities.EventOpsTask.filter({ pco_event_id: eventId });
      setTasks(tasksData);
    }
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      const updates = { status: newStatus };
      if (newStatus === 'done') {
        updates.completed_at = new Date().toISOString();
      }
      
      await base44.entities.EventOpsTask.update(taskId, updates);
      toast.success('Task updated');
      
      // Reload tasks
      const tasksData = await base44.entities.EventOpsTask.filter({ pco_event_id: eventId });
      setTasks(tasksData);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleTaskAssign = async (taskId, userEmail, userName) => {
    try {
      await base44.entities.EventOpsTask.update(taskId, {
        assigned_to_email: userEmail,
        assigned_to_name: userName
      });
      toast.success('Task assigned');
      
      // Reload tasks
      const tasksData = await base44.entities.EventOpsTask.filter({ pco_event_id: eventId });
      setTasks(tasksData);
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleTaskNotesChange = async (taskId, notes) => {
    try {
      await base44.entities.EventOpsTask.update(taskId, { notes });
      toast.success('Notes saved');
      
      // Reload tasks
      const tasksData = await base44.entities.EventOpsTask.filter({ pco_event_id: eventId });
      setTasks(tasksData);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600">Event not found</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-violet-50 to-purple-50 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Event Operations</h1>
            <p className="text-sm text-slate-600">Manage setup, maintenance, and post-event tasks</p>
          </div>
        </div>

        {/* Event Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              Event Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-bold text-slate-900 mb-4">{event.title}</h2>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">Start</p>
                  <p className="font-medium">{format(new Date(event.starts_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">End</p>
                  <p className="font-medium">{format(new Date(event.ends_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
            </div>

            {rooms.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Rooms</p>
                <div className="flex flex-wrap gap-2">
                  {rooms.map((room, idx) => (
                    <Badge key={idx} variant="outline" className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {room.room_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Requests */}
        {approvals.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Approval Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvals.map((approval, idx) => (
                <div key={idx} className="border-l-4 border-violet-500 pl-4">
                  <h3 className="font-semibold text-slate-900 mb-2">{approval.approval_group}</h3>
                  <Badge className={`mb-3 ${
                    approval.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                    approval.approval_status === 'denied' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {approval.approval_status}
                  </Badge>
                  
                  {approval.answers && Object.keys(approval.answers).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      {Object.entries(approval.answers).map(([question, answer], qIdx) => (
                        <div key={qIdx}>
                          <p className="text-xs font-semibold text-slate-700">{question}</p>
                          <p className="text-sm text-slate-600">{answer || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Ops Timeline */}
        {timeline && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Operations Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{timeline.maintenanceWindow.label}</p>
                    <p className="text-sm text-slate-600">
                      {format(timeline.maintenanceWindow.start, 'MMM d, h:mm a')} - {format(timeline.maintenanceWindow.end, 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-violet-500 mt-2" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{timeline.setupWindow.label}</p>
                    <p className="text-sm text-slate-600">
                      {format(timeline.setupWindow.start, 'MMM d, h:mm a')} - {format(timeline.setupWindow.end, 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{timeline.cleaningWindow.label}</p>
                    <p className="text-sm text-slate-600">
                      By {format(timeline.cleaningWindow.end, 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tasks Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">No tasks yet</p>
                <Button
                  onClick={() => generateTasks(event, approvals, timeline)}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Tasks
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    staffMembers={staffMembers}
                    onStatusChange={handleTaskStatusChange}
                    onAssign={handleTaskAssign}
                    onNotesChange={handleTaskNotesChange}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskItem({ task, staffMembers, onStatusChange, onAssign, onNotesChange }) {
  const [notes, setNotes] = useState(task.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const statusIcon = {
    'todo': <Circle className="w-5 h-5 text-slate-400" />,
    'in_progress': <Clock className="w-5 h-5 text-blue-500" />,
    'done': <CheckCircle2 className="w-5 h-5 text-green-500" />
  };

  const statusColors = {
    'todo': 'bg-slate-100 text-slate-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    'done': 'bg-green-100 text-green-700'
  };

  const handleSaveNotes = () => {
    onNotesChange(task.id, notes);
    setIsEditingNotes(false);
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          <button
            onClick={() => {
              const newStatus = task.status === 'done' ? 'todo' : 
                               task.status === 'todo' ? 'in_progress' : 'done';
              onStatusChange(task.id, newStatus);
            }}
            className="mt-0.5"
          >
            {statusIcon[task.status]}
          </button>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900">{task.task_name}</h4>
            {task.due_at && (
              <p className="text-xs text-slate-500 mt-1">
                Due: {format(new Date(task.due_at), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
        </div>
        <Badge className={statusColors[task.status]}>
          {task.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-slate-400" />
        <Select
          value={task.assigned_to_email || ''}
          onValueChange={(email) => {
            const user = staffMembers.find(u => u.email === email);
            if (user) {
              onAssign(task.id, user.email, user.full_name);
            }
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            {staffMembers.map(user => (
              <SelectItem key={user.id} value={user.email}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEditingNotes ? (
        <div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={3}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveNotes}>
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setNotes(task.notes || '');
              setIsEditingNotes(false);
            }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {notes ? (
            <div 
              className="text-sm text-slate-600 bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100"
              onClick={() => setIsEditingNotes(true)}
            >
              {notes}
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsEditingNotes(true)}
            >
              Add Notes
            </Button>
          )}
        </div>
      )}
    </div>
  );
}