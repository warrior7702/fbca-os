import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckSquare, 
  Calendar, 
  Mail, 
  ExternalLink, 
  AlertCircle,
  Flag,
  Inbox,
  Loader2,
  Paperclip
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import { toast } from "sonner";

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState({ focused: [], flagged: [] });
  const [loading, setLoading] = useState(true);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Check connections
      if (!currentUser.clickup_access_token) {
        toast.error('Please connect ClickUp in Settings');
      }

      if (!currentUser.microsoft_access_token) {
        toast.error('Please connect Microsoft 365 in Settings');
      }

      // Fetch ClickUp tasks
      if (currentUser.clickup_access_token) {
        try {
          const tasksResponse = await base44.functions.invoke('getMyClickUpTasks');
          setTasks(tasksResponse.data.tasks || []);
        } catch (error) {
          console.error('Error fetching tasks:', error);
          toast.error('Failed to load ClickUp tasks');
        }
      }

      // Fetch categorized emails
      if (currentUser.microsoft_access_token) {
        try {
          const emailsResponse = await base44.functions.invoke('getCategorizedEmails');
          setEmails(emailsResponse.data);
        } catch (error) {
          console.error('Error fetching emails:', error);
          toast.error('Failed to load emails');
        }
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const todayTasks = tasks.filter(task => 
    task.due_date && isToday(new Date(task.due_date))
  );

  const getPriorityBadge = (priority) => {
    const colors = {
      'urgent': 'bg-red-100 text-red-800',
      'high': 'bg-orange-100 text-orange-800',
      'normal': 'bg-blue-100 text-blue-800',
      'low': 'bg-gray-100 text-gray-800',
      'none': 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || colors['none'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.full_name;

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-600">Welcome back, {displayName}</p>
        </div>

        {/* Connection Warnings */}
        {(!user?.clickup_access_token || !user?.microsoft_access_token) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span>Some integrations are not connected. </span>
              <Link to={createPageUrl('Settings') + '?tab=integrations'} className="font-medium text-blue-600 hover:underline">
                Connect them in Settings
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Today's Tasks
              </CardTitle>
              <Badge variant="secondary">{todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No tasks due today! 🎉</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <a
                    key={task.id}
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 mb-1">{task.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getPriorityBadge(task.priority)}>
                            {task.priority === 'none' ? 'No Priority' : task.priority}
                          </Badge>
                          <Badge variant="outline">{task.status}</Badge>
                          {task.list_name && (
                            <span className="text-xs text-slate-500">{task.list_name}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Task Calendar - Next 2 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskCalendar 
              tasks={tasks} 
              onOpenFullView={() => setShowFullCalendar(true)}
            />
          </CardContent>
        </Card>

        {/* Categorized Emails */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Focused Inbox */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-blue-600" />
                Focused Inbox
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emails.focused.length === 0 ? (
                <p className="text-slate-500 text-sm">No focused emails</p>
              ) : (
                <div className="space-y-2">
                  {emails.focused.slice(0, 5).map((email, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        email.isRead ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm flex-1 ${email.isRead ? 'font-normal' : 'font-semibold'}`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        {email.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600">{email.fromName || email.from}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(email.receivedAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flagged Emails */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-orange-600" />
                Flagged
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emails.flagged.length === 0 ? (
                <p className="text-slate-500 text-sm">No flagged emails</p>
              ) : (
                <div className="space-y-2">
                  {emails.flagged.slice(0, 5).map((email, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        email.isRead ? 'bg-white border-slate-200' : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm flex-1 ${email.isRead ? 'font-normal' : 'font-semibold'}`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        {email.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600">{email.fromName || email.from}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(email.receivedAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Calendar Modal */}
      <FullCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        tasks={tasks}
      />
    </div>
  );
}