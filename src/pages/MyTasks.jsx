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
  Paperclip,
  Tag
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, parseISO } from "date-fns";
import TaskCalendar from "../components/tasks/TaskCalendar";
import FullCalendarModal from "../components/tasks/FullCalendarModal";
import { toast } from "sonner";

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState({ focused: [], flagged: [], categorized: {} });
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

      if (!currentUser.clickup_access_token) {
        toast.error('Please connect ClickUp in Settings');
      }

      if (!currentUser.microsoft_access_token) {
        toast.error('Please connect Microsoft 365 in Settings');
      }

      if (currentUser.clickup_access_token) {
        try {
          const tasksResponse = await base44.functions.invoke('getMyClickUpTasks');
          setTasks(tasksResponse.data.tasks || []);
        } catch (error) {
          console.error('Error fetching tasks:', error);
          toast.error('Failed to load ClickUp tasks');
        }
      }

      if (currentUser.microsoft_access_token) {
        try {
          const emailsResponse = await base44.functions.invoke('getCategorizedEmails');
          console.log('Emails response:', emailsResponse.data);
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
      'urgent': 'bg-red-500 text-white border-red-600',
      'high': 'bg-orange-400 text-white border-orange-500',
      'normal': 'bg-blue-400 text-white border-blue-500',
      'low': 'bg-gray-300 text-gray-800 border-gray-400',
      'none': 'bg-slate-300 text-slate-800 border-slate-400'
    };
    return colors[priority] || colors['none'];
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('ready') || statusLower.includes('to do')) return 'bg-green-500 text-white border-green-600';
    if (statusLower.includes('awaiting') || statusLower.includes('waiting')) return 'bg-pink-500 text-white border-pink-600';
    if (statusLower.includes('reminder') || statusLower.includes('pending')) return 'bg-blue-500 text-white border-blue-600';
    if (statusLower.includes('progress') || statusLower.includes('active') || statusLower.includes('in dev')) return 'bg-purple-500 text-white border-purple-600';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'bg-gray-500 text-white border-gray-600';
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) return 'bg-red-500 text-white border-red-600';
    if (statusLower.includes('review') || statusLower.includes('qa')) return 'bg-orange-500 text-white border-orange-600';
    
    return 'bg-slate-400 text-white border-slate-500';
  };

  const getCategoryColor = (category) => {
    const categoryLower = category?.toLowerCase() || '';
    
    if (categoryLower.includes('action') || categoryLower.includes('needed')) return 'bg-orange-500 text-white';
    if (categoryLower.includes('followup') || categoryLower.includes('follow')) return 'bg-purple-500 text-white';
    if (categoryLower.includes('network') || categoryLower.includes('networking')) return 'bg-yellow-400 text-black';
    if (categoryLower.includes('pending') || categoryLower.includes('order')) return 'bg-teal-500 text-white';
    if (categoryLower.includes('important') || categoryLower.includes('urgent')) return 'bg-red-500 text-white';
    if (categoryLower.includes('personal') || categoryLower.includes('private')) return 'bg-blue-500 text-white';
    if (categoryLower.includes('project') || categoryLower.includes('work')) return 'bg-indigo-500 text-white';
    
    return 'bg-slate-500 text-white';
  };

  const openOutlook = () => {
    window.open('https://outlook.office.com/mail/', '_blank');
  };

  // Count unread focused emails
  const unreadFocusedCount = emails.focused?.filter(e => !e.isRead).length || 0;

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
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-600">Welcome back, {displayName}</p>
        </div>

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
                          <Badge className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* Focused Inbox - Unread Count */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-blue-600" />
                Focused Inbox
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <div className="text-4xl font-bold text-blue-600 mb-1">{unreadFocusedCount}</div>
                  <p className="text-sm text-slate-600">Unread messages</p>
                </div>
                <Button onClick={openOutlook} className="bg-blue-600 hover:bg-blue-700">
                  <Mail className="w-4 h-4 mr-2" />
                  Open Outlook
                </Button>
              </div>
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
              {!emails.flagged || emails.flagged.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No flagged emails</p>
              ) : (
                <div className="space-y-2">
                  {emails.flagged.slice(0, 5).map((email, idx) => (
                    <div
                      key={idx}
                      onClick={openOutlook}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        email.isRead 
                          ? 'bg-white border-slate-200' 
                          : 'bg-orange-50 border-orange-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm flex-1 ${email.isRead ? 'font-normal text-slate-700' : 'font-bold text-slate-900'}`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Flag className="w-3 h-3 text-orange-600" />
                          {!email.isRead && (
                            <div className="w-2 h-2 bg-orange-600 rounded-full" title="Unread" />
                          )}
                          {email.hasAttachments && (
                            <Paperclip className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs text-slate-600">{email.fromName || email.from}</p>
                        <div className="flex items-center gap-2">
                          {email.categories && email.categories.length > 0 && (
                            <div className="flex gap-1">
                              {email.categories.slice(0, 2).map((cat, i) => (
                                <Badge key={i} className={`text-[10px] px-1.5 py-0 ${getCategoryColor(cat)}`}>
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-slate-500">
                            {format(parseISO(email.receivedAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Categorized Emails Section */}
        {emails.categorized && Object.keys(emails.categorized).length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(emails.categorized).slice(0, 4).map(([category, categoryEmails]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    <Badge className={getCategoryColor(category)}>{category}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!categoryEmails || categoryEmails.length === 0 ? (
                    <p className="text-slate-500 text-sm">No emails in this category</p>
                  ) : (
                    <div className="space-y-2">
                      {categoryEmails.slice(0, 3).map((email, idx) => (
                        <div
                          key={idx}
                          onClick={openOutlook}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                            email.isRead 
                              ? 'bg-white border-slate-200' 
                              : 'bg-slate-50 border-slate-300 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm flex-1 ${email.isRead ? 'font-normal text-slate-700' : 'font-bold text-slate-900'}`}>
                              {email.subject || '(No Subject)'}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!email.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full" title="Unread" />
                              )}
                              {email.hasAttachments && (
                                <Paperclip className="w-3 h-3 text-slate-400" />
                              )}
                            </div>
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
            ))}
          </div>
        )}
      </div>

      <FullCalendarModal
        open={showFullCalendar}
        onOpenChange={setShowFullCalendar}
        tasks={tasks}
      />
    </div>
  );
}