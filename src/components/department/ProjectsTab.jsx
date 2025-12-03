import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Loader2,
  Ticket,
  ListChecks,
  Sparkles,
  Clock,
  Flag,
  FolderKanban,
  Edit2,
  Trash2,
  ChevronRight
} from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ProjectsTab({ 
  userDepartments, 
  departmentWorkers, 
  user,
  isPreviewMode 
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [weeklyFocus, setWeeklyFocus] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskSource, setTaskSource] = useState(null); // { type: 'project' | 'focus', item: ... }
  
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    target_date: '',
    owner_email: '',
    owner_name: ''
  });

  const [editingFocus, setEditingFocus] = useState(false);
  const [focusItems, setFocusItems] = useState([
    { title: '', description: '', completed: false },
    { title: '', description: '', completed: false },
    { title: '', description: '', completed: false }
  ]);

  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const primaryDept = userDepartments[0] || 'General';

  useEffect(() => {
    loadData();
  }, [userDepartments]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, focusData] = await Promise.all([
        base44.entities.DeptProject.filter({ department: primaryDept }),
        base44.entities.WeeklyFocus.filter({ department: primaryDept, week_of: currentWeekStart })
      ]);
      
      setProjects(projectsData.filter(p => p.status !== 'completed'));
      
      if (focusData.length > 0) {
        setWeeklyFocus(focusData[0]);
        setFocusItems(focusData[0].focus_items?.length > 0 
          ? [...focusData[0].focus_items, ...Array(3 - focusData[0].focus_items.length).fill({ title: '', description: '', completed: false })].slice(0, 3)
          : [{ title: '', description: '', completed: false }, { title: '', description: '', completed: false }, { title: '', description: '', completed: false }]
        );
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    
    try {
      if (editingProject) {
        await base44.entities.DeptProject.update(editingProject.id, {
          ...newProject,
          department: primaryDept
        });
        toast.success('Project updated');
      } else {
        await base44.entities.DeptProject.create({
          ...newProject,
          department: primaryDept
        });
        toast.success('Project created');
      }
      setShowProjectModal(false);
      setEditingProject(null);
      setNewProject({ title: '', description: '', status: 'planning', priority: 'medium', target_date: '', owner_email: '', owner_name: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to save project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await base44.entities.DeptProject.delete(projectId);
      toast.success('Project deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleSaveFocus = async () => {
    try {
      const validItems = focusItems.filter(item => item.title.trim());
      
      if (weeklyFocus) {
        await base44.entities.WeeklyFocus.update(weeklyFocus.id, {
          focus_items: validItems
        });
      } else {
        await base44.entities.WeeklyFocus.create({
          department: primaryDept,
          week_of: currentWeekStart,
          focus_items: validItems
        });
      }
      toast.success('Weekly focus saved');
      setEditingFocus(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save focus');
    }
  };

  const toggleFocusComplete = async (index) => {
    const updatedItems = [...focusItems];
    updatedItems[index] = { ...updatedItems[index], completed: !updatedItems[index].completed };
    setFocusItems(updatedItems);
    
    if (weeklyFocus) {
      try {
        await base44.entities.WeeklyFocus.update(weeklyFocus.id, {
          focus_items: updatedItems.filter(item => item.title.trim())
        });
      } catch (error) {
        console.error('Error updating focus:', error);
      }
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      const worker = departmentWorkers.find(w => w.user_email === taskData.assignee);
      await base44.entities.DeptTask.create({
        title: taskData.title,
        details: taskData.details,
        assignee: taskData.assignee,
        assignee_name: worker?.user_name || taskData.assignee,
        due_date: taskData.due_date || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        completed: false,
        department: primaryDept
      });
      toast.success('Task created!');
      setShowCreateTaskModal(false);
      setTaskSource(null);
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleCreateTicket = (source) => {
    const params = new URLSearchParams();
    params.set('subject', `[${primaryDept}] ${source.title}`);
    params.set('description', source.description || `Related to: ${source.title}`);
    navigate(createPageUrl('CreateTicket') + `?${params.toString()}`);
  };

  const getStatusColor = (status) => {
    const colors = {
      planning: 'bg-slate-100 text-slate-700 border-slate-300',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
      on_hold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      completed: 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[status] || colors.planning;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-slate-100 text-slate-600',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700'
    };
    return colors[priority] || colors.medium;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Focus - Top 3 */}
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              Weekly Focus
              <Badge variant="outline" className="ml-2 text-xs">
                Week of {format(new Date(currentWeekStart), 'MMM d')}
              </Badge>
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setEditingFocus(!editingFocus)}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              {editingFocus ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingFocus ? (
            <div className="space-y-3">
              {focusItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder={`Focus item ${idx + 1}...`}
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...focusItems];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setFocusItems(updated);
                      }}
                    />
                    <Input
                      placeholder="Brief description (optional)"
                      value={item.description || ''}
                      onChange={(e) => {
                        const updated = [...focusItems];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setFocusItems(updated);
                      }}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
              <Button onClick={handleSaveFocus} className="w-full bg-amber-600 hover:bg-amber-700">
                Save Weekly Focus
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {focusItems.filter(item => item.title).length === 0 ? (
                <p className="text-center text-amber-600 py-4">
                  No focus items set for this week. Click Edit to add your top 3 priorities.
                </p>
              ) : (
                focusItems.filter(item => item.title).map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-3 p-3 bg-white rounded-lg border transition-all ${
                      item.completed ? 'border-green-300 bg-green-50' : 'border-amber-200 hover:shadow-md'
                    }`}
                  >
                    <button 
                      onClick={() => toggleFocusComplete(idx)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-amber-400 hover:text-amber-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${item.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTaskSource({ type: 'focus', item });
                          setShowCreateTaskModal(true);
                        }}
                        title="Create Task"
                      >
                        <ListChecks className="w-4 h-4 text-teal-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCreateTicket(item)}
                        title="Create Ticket"
                      >
                        <Ticket className="w-4 h-4 text-purple-600" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-violet-600" />
              Active Projects
              <Badge variant="secondary" className="ml-2">{projects.length}</Badge>
            </CardTitle>
            <Button 
              onClick={() => {
                setEditingProject(null);
                setNewProject({ title: '', description: '', status: 'planning', priority: 'medium', target_date: '', owner_email: '', owner_name: '' });
                setShowProjectModal(true);
              }}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FolderKanban className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No active projects yet</p>
              <p className="text-sm">Create a project to track department initiatives</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  className="p-4 bg-white rounded-lg border hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{project.title}</h3>
                        <Badge className={getPriorityColor(project.priority)}>
                          {project.priority}
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-slate-600 mb-2">{project.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <Badge variant="outline" className={getStatusColor(project.status)}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                        {project.target_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(project.target_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {project.owner_name && (
                          <span className="flex items-center gap-1">
                            Owner: {project.owner_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTaskSource({ type: 'project', item: project });
                          setShowCreateTaskModal(true);
                        }}
                        title="Create Task"
                      >
                        <ListChecks className="w-4 h-4 text-teal-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCreateTicket(project)}
                        title="Create Ticket"
                      >
                        <Ticket className="w-4 h-4 text-purple-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingProject(project);
                          setNewProject({
                            title: project.title,
                            description: project.description || '',
                            status: project.status,
                            priority: project.priority,
                            target_date: project.target_date || '',
                            owner_email: project.owner_email || '',
                            owner_name: project.owner_name || ''
                          });
                          setShowProjectModal(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Modal */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Project title"
              value={newProject.title}
              onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newProject.status} onValueChange={(v) => setNewProject({ ...newProject, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newProject.priority} onValueChange={(v) => setNewProject({ ...newProject, priority: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={newProject.target_date}
              onChange={(e) => setNewProject({ ...newProject, target_date: e.target.value })}
              placeholder="Target date"
            />
            <Select 
              value={newProject.owner_email} 
              onValueChange={(v) => {
                const worker = departmentWorkers.find(w => w.user_email === v);
                setNewProject({ 
                  ...newProject, 
                  owner_email: v,
                  owner_name: worker?.user_name || v
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Project Owner" />
              </SelectTrigger>
              <SelectContent>
                {departmentWorkers.map((worker) => (
                  <SelectItem key={worker.user_email} value={worker.user_email}>
                    {worker.user_name || worker.user_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectModal(false)}>Cancel</Button>
            <Button onClick={handleSaveProject} className="bg-violet-600 hover:bg-violet-700">
              {editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <CreateTaskFromSourceModal
        open={showCreateTaskModal}
        onOpenChange={setShowCreateTaskModal}
        source={taskSource}
        workers={departmentWorkers}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}

function CreateTaskFromSourceModal({ open, onOpenChange, source, workers, onCreateTask }) {
  const [taskData, setTaskData] = useState({
    title: '',
    details: '',
    assignee: '',
    due_date: ''
  });

  useEffect(() => {
    if (source) {
      setTaskData({
        title: source.item.title || '',
        details: source.item.description || '',
        assignee: '',
        due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd')
      });
    }
  }, [source]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-teal-600" />
            Create Task from {source?.type === 'project' ? 'Project' : 'Focus Item'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="Task title"
            value={taskData.title}
            onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
          />
          <Textarea
            placeholder="Details"
            value={taskData.details}
            onChange={(e) => setTaskData({ ...taskData, details: e.target.value })}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={taskData.assignee} onValueChange={(v) => setTaskData({ ...taskData, assignee: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.user_email} value={worker.user_email}>
                    {worker.user_name || worker.user_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={taskData.due_date}
              onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => onCreateTask(taskData)}
            disabled={!taskData.title || !taskData.assignee}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}