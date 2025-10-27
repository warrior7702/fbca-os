import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ExternalLink, 
  Calendar,
  User,
  Tag,
  Clock,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

export default function TaskDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('id');
    
    if (taskId) {
      loadTask(taskId);
    } else {
      navigate(createPageUrl('MyTasks'));
    }
  }, [location.search]);

  const loadTask = async (taskId) => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (!user.clickup_access_token) {
        navigate(createPageUrl('Settings') + '?tab=integrations');
        return;
      }

      // Fetch all tasks and find the one we need
      const response = await base44.functions.invoke('getMyClickUpTasks');
      const foundTask = response.data.tasks.find(t => t.id === taskId);
      
      if (foundTask) {
        setTask(foundTask);
      } else {
        navigate(createPageUrl('MyTasks'));
      }
    } catch (error) {
      console.error('Error loading task:', error);
      navigate(createPageUrl('MyTasks'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('MyTasks'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Task Details</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-xl">{task.title}</CardTitle>
              {task.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(task.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in ClickUp
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {task.description && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Description</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Status:</span>
                <Badge>{task.status}</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Priority:</span>
                <Badge>{task.priority || 'None'}</Badge>
              </div>

              {task.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Due:</span>
                  <span className="text-sm font-medium">
                    {format(new Date(task.due_date), 'PPP')}
                  </span>
                </div>
              )}

              {task.list_name && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">List:</span>
                  <span className="text-sm font-medium">{task.list_name}</span>
                </div>
              )}

              {task.assignees && task.assignees.length > 0 && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Assignees:</span>
                  <span className="text-sm font-medium">{task.assignees.join(', ')}</span>
                </div>
              )}

              {task.time_estimate && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Estimate:</span>
                  <span className="text-sm font-medium">
                    {Math.round(task.time_estimate / 3600000)}h
                  </span>
                </div>
              )}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Tags</h3>
                <div className="flex gap-2 flex-wrap">
                  {task.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}