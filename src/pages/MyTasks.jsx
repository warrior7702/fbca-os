import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  RefreshCw,
  ListTodo,
  CheckCircle,
  Clock,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from 'sonner';
import ScheduleCalendar from "@/components/tasks/ScheduleCalendar";
import { format, isToday, parseISO } from "date-fns";

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myScheduleEvents, setMyScheduleEvents] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [supportTickets, setSupportTickets] = useState([]);
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      await Promise.all([
        loadMySchedule(),
        loadSupportTickets()
      ]);
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const loadSupportTickets = async () => {
    setLoadingSupportTickets(true);
    try {
      const currentUser = await base44.auth.me();
      const tickets = await base44.entities.Ticket.filter({
        assigned_to: currentUser.email,
        status: ['open', 'in_progress', 'pending']
      });
      setSupportTickets(tickets || []);
    } catch (error) {
      console.error('Failed to load support tickets:', error);
      setSupportTickets([]);
    } finally {
      setLoadingSupportTickets(false);
    }
  };

  const loadMySchedule = async () => {
    console.log('🗓️ ========== LOADING MY SCHEDULE ==========');
    console.log('User:', user);
    
    setLoadingSchedule(true);
    
    try {
      // Load from database (fast) - no blocking sync
      console.log('📞 Getting my pending approvals from database...');
      const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
      console.log('✅ Approvals response:', approvalsResponse.data);
      
      const approvals = approvalsResponse.data.pending_approvals || [];
      console.log('✅ Approvals count:', approvals.length);
      
      if (approvals.length === 0) {
        console.log('⚠️ No approvals found');
        setMyScheduleEvents([]);
        setLoadingSchedule(false);
        return;
      }

      const myResourceNames = [...new Set(approvals.map(a => a.resource_name).filter(Boolean))];
      console.log('📋 My resources:', myResourceNames);

      // Get calendar events
      console.log('📞 Getting calendar events...');
      const eventsResponse = await base44.functions.invoke('getPCOCalendarEvents');
      
      if (!eventsResponse.data || !eventsResponse.data.events) {
        console.error('❌ No events data returned');
        throw new Error('No events data returned from getPCOCalendarEvents');
      }
      
      const allEvents = eventsResponse.data.events || [];
      console.log('📅 Total events:', allEvents.length);

      // Filter to my events
      const myEvents = allEvents.filter(event => {
        return event.resources && event.resources.some(r => myResourceNames.includes(r.name));
      });

      console.log('🎯 Matched events:', myEvents.length);
      
      if (myEvents.length === 0) {
        console.warn('⚠️ No events matched my resources');
        setMyScheduleEvents([]);
        setLoadingSchedule(false);
        return;
      }
      
      myEvents.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

      // Show events immediately
      console.log('✅ Setting events to state (without door codes yet)');
      setMyScheduleEvents(myEvents);
      setLoadingSchedule(false); // Mark as done loading even before door codes
      
      // STEP 4: Fetch door codes in BACKGROUND (don't let errors affect the schedule)
      console.log('🚪 Now fetching door codes in background...');
      
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      const recentEvents = myEvents.filter(event => {
        const eventDate = new Date(event.starts_at);
        return eventDate <= twoWeeksFromNow;
      });

      console.log(`🚪 Fetching door codes for ${recentEvents.length} events`);
      
      // Fetch door codes in parallel with timeout - wrapped in try/catch to not affect schedule
      try {
        const doorCodePromises = recentEvents.map(event => 
          Promise.race([
            base44.functions.invoke('getPCOEventComments', { event_id: event.event_id })
              .then(commentsResponse => {
                if (commentsResponse.data.comments) {
                  const doorCodeComment = commentsResponse.data.comments.find(c =>
                    c.body?.includes('🚪 Building Access Approved') && c.body?.includes('Door Code:')
                  );

                  if (doorCodeComment) {
                    const match = doorCodeComment.body.match(/Door Code:\s*(\d+)/);
                    if (match) {
                      return {
                        event_id: event.event_id,
                        posted_door_code: match[1],
                        posted_by: doorCodeComment.created_by
                      };
                    }
                  }
                }
                return { event_id: event.event_id };
              })
              .catch(error => {
                console.error(`Error fetching comments for event ${event.event_id}:`, error.message);
                return { event_id: event.event_id };
              }),
            // Timeout after 5 seconds
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('timeout')), 5000)
            )
          ]).catch(error => {
            if (error.message === 'timeout') {
              console.warn(`⏱️ Timeout fetching door code for event ${event.event_id}`);
            }
            return { event_id: event.event_id };
          })
        );

        // Wait for all door code fetches (with timeout)
        const doorCodeResults = await Promise.all(doorCodePromises);
        
        // Update events with door codes
        const updatedEvents = myEvents.map(event => {
          const doorCodeData = doorCodeResults.find(r => r.event_id === event.event_id);
          if (doorCodeData?.posted_door_code) {
            return {
              ...event,
              posted_door_code: doorCodeData.posted_door_code,
              posted_by: doorCodeData.posted_by
            };
          }
          return event;
        });

        console.log('✅ Door codes fetched:', updatedEvents.filter(e => e.posted_door_code).length, 'have codes');
        setMyScheduleEvents(updatedEvents);
      } catch (doorCodeError) {
        console.warn('⚠️ Door code fetching failed, but keeping schedule:', doorCodeError.message);
        // Don't clear the schedule - we already have events showing
      }

      console.log('✅ SUCCESS! Schedule fully loaded');
      
    } catch (error) {
      console.error('❌ FATAL ERROR in loadMySchedule:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      const errorMsg = error.message || 'Unknown error';
      toast.error(`Failed to load schedule: ${errorMsg}`);
      
      setMyScheduleEvents([]);
      setLoadingSchedule(false);
    }
  };

  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh clicked - refreshing schedule');
    await loadMySchedule();
    toast.success('Schedule refreshed!');
  };

  // Calculate today's tasks
  const todaysTasks = myScheduleEvents.filter(event => {
    try {
      return isToday(parseISO(event.starts_at));
    } catch {
      return false;
    }
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
            <p className="text-slate-600">Welcome back, {user?.full_name || user?.email?.split('@')[0]}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-blue-200 bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Today</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-blue-600">{todaysTasks.length}</p>
                    <p className="text-sm text-slate-500">Tasks Due</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Support Tickets</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-purple-600">{supportTickets.length}</p>
                    <p className="text-sm text-slate-500">Open</p>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <ListTodo className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">This Week</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-green-600">{myScheduleEvents.length}</p>
                    <p className="text-sm text-slate-500">Events</p>
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <CalendarIcon className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Schedule */}
        <Card className="border-2 border-green-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-green-600" />
                  My Schedule
                </CardTitle>
                <p className="text-slate-600 text-sm mt-1">
                  Upcoming events with your door codes • {myScheduleEvents.length} event{myScheduleEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button 
                onClick={handleManualRefresh} 
                disabled={loadingSchedule} 
                variant="outline" 
                size="sm"
                title="Refresh schedule"
              >
                {loadingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSchedule ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                <p className="text-slate-600">Loading your schedule...</p>
              </div>
            ) : myScheduleEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">No upcoming events found</p>
              </div>
            ) : (
              <ScheduleCalendar events={myScheduleEvents} weekCount={2} />
            )}
          </CardContent>
        </Card>

        {/* My Day - Support Tickets */}
        <Card className="border-2 border-purple-200 bg-white">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-purple-600" />
              My Day
            </CardTitle>
            <p className="text-slate-600 text-sm">
              {supportTickets.length} task{supportTickets.length !== 1 ? 's' : ''}
            </p>
          </CardHeader>
          <CardContent>
            {loadingSupportTickets ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                <p className="text-slate-600">Loading tasks...</p>
              </div>
            ) : supportTickets.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">All caught up!</p>
                <p className="text-slate-500 text-sm">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {supportTickets.slice(0, 10).map((ticket) => (
                  <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              className={
                                ticket.status === 'open' ? 'bg-blue-100 text-blue-700' :
                                ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-700'
                              }
                            >
                              {ticket.status === 'open' ? 'Working' : 
                               ticket.status === 'in_progress' ? 'In Progress' : 
                               ticket.status}
                            </Badge>
                            <span className="text-xs text-slate-500">{ticket.ticket_number}</span>
                          </div>
                          <p className="font-medium text-slate-900">{ticket.subject}</p>
                          <p className="text-sm text-slate-600 line-clamp-1">{ticket.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}