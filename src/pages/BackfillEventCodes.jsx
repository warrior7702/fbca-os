import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Key,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function BackfillEventCodes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [processing, setProcessing] = useState({});
  const [editingAccessTime, setEditingAccessTime] = useState({});
  const [editingDoorCode, setEditingDoorCode] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_user') {
        toast.error('Admin access required');
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Get schedule events
      const response = await base44.functions.invoke('getMySchedule');
      if (response.data?.events) {
        setEvents(response.data.events);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId) => {
    setProcessing(prev => ({ ...prev, [eventId]: true }));
    try {
      // Get event comments to find posted door codes
      const commentsResponse = await base44.functions.invoke('getPCOEventComments', {
        event_id: eventId
      });

      let postedCode = null;
      let accessTime = null;

      if (commentsResponse.data?.comments) {
        // Look for door code in comments
        const doorCodeComment = commentsResponse.data.comments.find(c =>
          c.body?.includes('🚪 Building Access Approved') && c.body?.includes('Door Code:')
        );

        if (doorCodeComment) {
          const codeMatch = doorCodeComment.body.match(/Door Code:\s*(\d+)/i);
          if (codeMatch) {
            postedCode = codeMatch[1];
          }
          // Also try to extract access time
          const timeMatch = doorCodeComment.body.match(/Access Time:\s*([^\n]+)/i);
          if (timeMatch) {
            accessTime = timeMatch[1].trim();
          }
        }

        // Also check for unlock
        const unlockComment = commentsResponse.data.comments.find(c =>
          c.body?.toLowerCase().includes('unlock')
        );
        if (unlockComment && !postedCode) {
          postedCode = 'Unlock';
        }
      }

      // Update the event in our local state
      setEvents(prev => prev.map(e => {
        if (e.event_id === eventId) {
          return {
            ...e,
            posted_door_code: postedCode || e.posted_door_code,
            access_time: accessTime || e.access_time
          };
        }
        return e;
      }));

      if (postedCode) {
        toast.success(`Found code: ${postedCode}`);
      } else {
        toast.info('No door code found in comments');
      }

    } catch (error) {
      console.error('Error fetching event details:', error);
      toast.error('Failed to fetch event details');
    } finally {
      setProcessing(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const saveEventCode = async (event) => {
    const accessTime = editingAccessTime[event.event_id] ?? event.access_time;
    const doorCode = editingDoorCode[event.event_id] ?? event.posted_door_code;

    if (!doorCode) {
      toast.error('Please enter a door code');
      return;
    }

    setProcessing(prev => ({ ...prev, [event.event_id]: true }));
    try {
      // Post the code to PCO
      const response = await base44.functions.invoke('writePCONote', {
        event_id: event.event_id,
        badge_code: doorCode,
        access_time: accessTime
      });

      if (response.data?.ok) {
        toast.success('Code saved to PCO!');
        
        // Update local state
        setEvents(prev => prev.map(e => {
          if (e.event_id === event.event_id) {
            return {
              ...e,
              posted_door_code: doorCode,
              access_time: accessTime
            };
          }
          return e;
        }));

        // Clear editing state
        setEditingAccessTime(prev => {
          const next = { ...prev };
          delete next[event.event_id];
          return next;
        });
        setEditingDoorCode(prev => {
          const next = { ...prev };
          delete next[event.event_id];
          return next;
        });
      } else {
        toast.error(response.data?.error || 'Failed to save code');
      }
    } catch (error) {
      console.error('Error saving code:', error);
      toast.error('Failed to save code');
    } finally {
      setProcessing(prev => ({ ...prev, [event.event_id]: false }));
    }
  };

  const eventsWithoutCodes = events.filter(e => !e.posted_door_code);
  const eventsWithCodes = events.filter(e => e.posted_door_code);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-gray-100 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Backfill Event Codes</h1>
              <p className="text-sm text-slate-600">
                Add access times and door codes to legacy events
              </p>
            </div>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold text-orange-600">{eventsWithoutCodes.length}</p>
                  <p className="text-sm text-slate-600">Missing Codes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{eventsWithCodes.length}</p>
                  <p className="text-sm text-slate-600">Have Codes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events without codes */}
        {eventsWithoutCodes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Events Needing Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventsWithoutCodes.map((event) => (
                <div 
                  key={event.id} 
                  className="border rounded-lg p-4 bg-orange-50 border-orange-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{event.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Calendar className="w-4 h-4" />
                        {format(parseISO(event.starts_at), 'EEE, MMM d, yyyy')}
                        <span>•</span>
                        <Clock className="w-4 h-4" />
                        {format(parseISO(event.starts_at), 'h:mm a')}
                      </div>
                      {event.resources?.map((r, idx) => (
                        <Badge key={idx} variant="outline" className="mt-2 mr-1">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={() => fetchEventDetails(event.event_id)}
                      disabled={processing[event.event_id]}
                      variant="outline"
                      size="sm"
                    >
                      {processing[event.event_id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Scan PCO
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        Access Time (e.g., "9:00 AM - 4:00 PM")
                      </label>
                      <Input
                        placeholder="e.g., 9:00 AM - 4:00 PM"
                        value={editingAccessTime[event.event_id] ?? event.access_time ?? ''}
                        onChange={(e) => setEditingAccessTime(prev => ({
                          ...prev,
                          [event.event_id]: e.target.value
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        Door Code
                      </label>
                      <Input
                        placeholder="e.g., 123456 or Unlock"
                        value={editingDoorCode[event.event_id] ?? event.posted_door_code ?? ''}
                        onChange={(e) => setEditingDoorCode(prev => ({
                          ...prev,
                          [event.event_id]: e.target.value
                        }))}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => saveEventCode(event)}
                    disabled={processing[event.event_id]}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {processing[event.event_id] ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save to PCO
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Events with codes */}
        {eventsWithCodes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Events With Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventsWithCodes.map((event) => (
                <div 
                  key={event.id} 
                  className="border rounded-lg p-3 bg-green-50 border-green-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{event.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Calendar className="w-4 h-4" />
                        {format(parseISO(event.starts_at), 'MMM d')}
                        <span>•</span>
                        <Clock className="w-4 h-4" />
                        {format(parseISO(event.starts_at), 'h:mm a')}
                      </div>
                    </div>
                    <div className="text-right">
                      {event.access_time && (
                        <p className="text-xs text-slate-600 mb-1">{event.access_time}</p>
                      )}
                      <Badge className="bg-green-200 text-green-800 font-mono">
                        <Key className="w-3 h-3 mr-1" />
                        {event.posted_door_code}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {events.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No events found in your schedule</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}