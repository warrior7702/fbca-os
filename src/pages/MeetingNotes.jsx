import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  FileText, 
  Calendar, 
  Clock, 
  Users,
  ChevronRight,
  Loader2,
  Download,
  Search,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/shared/AppHeader";
import { format, parseISO, isToday, isYesterday, startOfDay, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function MeetingNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser) return;

      const allNotes = await base44.entities.MeetingNote.filter({
        user_email: currentUser.email
      });

      // Sort by meeting date, most recent first
      const sortedNotes = allNotes.sort((a, b) => 
        new Date(b.meeting_date) - new Date(a.meeting_date)
      );

      setNotes(sortedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadNotes = (note) => {
    const notesContent = `Meeting Notes - ${note.meeting_subject || 'Meeting'}

Date: ${format(parseISO(note.meeting_date), 'PPpp')}

Summary:
${note.summary || 'No summary available.'}

${note.action_items && note.action_items.length > 0 ? 'Action Items:\n' + note.action_items.map(item => `- ${item}`).join('\n') : ''}

Transcript:
${note.transcript || 'No transcript available.'}
`;

    const blob = new Blob([notesContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${format(parseISO(note.meeting_date), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  // Group notes by date
  const groupedNotes = notes.reduce((groups, note) => {
    const dateLabel = getDateLabel(note.meeting_date);
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(note);
    return groups;
  }, {});

  // Filter notes based on search
  const filteredGroupedNotes = Object.entries(groupedNotes).reduce((acc, [dateLabel, dateNotes]) => {
    const filtered = dateNotes.filter(note => {
      const searchLower = searchQuery.toLowerCase();
      return (
        note.meeting_subject?.toLowerCase().includes(searchLower) ||
        note.summary?.toLowerCase().includes(searchLower) ||
        note.transcript?.toLowerCase().includes(searchLower)
      );
    });
    if (filtered.length > 0) {
      acc[dateLabel] = filtered;
    }
    return acc;
  }, {});

  const highlightKeywords = (text) => {
    if (!text) return '';
    
    // Simple keyword highlighting - you can expand this
    const keywords = ['parking', 'security', 'staff', 'event', 'discussed', 'decided'];
    let highlighted = text;
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-blue-600 font-medium">$1</span>');
    });
    
    return highlighted;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={FileText}
          title="Meeting Notes"
          description={`${notes.length} meeting${notes.length !== 1 ? 's' : ''} recorded`}
          iconColor="from-blue-500 to-indigo-500"
          action={
            <Button 
              onClick={() => navigate(createPageUrl('MyMeetings'))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Calendar className="w-4 h-4 mr-2" />
              My Meetings
            </Button>
          }
        />

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 text-base"
          />
        </div>

        {/* Notes List */}
        {Object.keys(filteredGroupedNotes).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? 'No notes found' : 'No meeting notes yet'}
              </h3>
              <p className="text-slate-600 mb-4">
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Start recording meetings to create AI-powered notes'
                }
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => navigate(createPageUrl('MyMeetings'))}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Go to Meetings
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(filteredGroupedNotes).map(([dateLabel, dateNotes]) => (
              <div key={dateLabel}>
                <h2 className="text-lg font-semibold text-slate-700 mb-4 sticky top-0 bg-gradient-to-br from-slate-50 to-blue-50 py-2 z-10">
                  {dateLabel}
                </h2>
                <div className="space-y-4">
                  {dateNotes.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200"
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-slate-900">
                                  {note.meeting_subject || 'Untitled Meeting'}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(parseISO(note.meeting_date), 'h:mm a')}
                                  </span>
                                  {note.recording_duration && (
                                    <span className="flex items-center gap-1">
                                      • {formatRecordingTime(note.recording_duration)} min
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadNotes(note)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Summary */}
                        {note.summary && (
                          <div className="mb-4">
                            <p 
                              className="text-slate-700 leading-relaxed"
                              dangerouslySetInnerHTML={{ 
                                __html: highlightKeywords(note.summary) 
                              }}
                            />
                          </div>
                        )}

                        {/* Action Items */}
                        {note.action_items && note.action_items.length > 0 && (
                          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-amber-600" />
                              <p className="text-sm font-semibold text-amber-900">
                                Action Items
                              </p>
                            </div>
                            <ul className="space-y-2">
                              {note.action_items.slice(0, 3).map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            {note.action_items.length > 3 && (
                              <p className="text-xs text-amber-700 mt-2">
                                +{note.action_items.length - 3} more action items
                              </p>
                            )}
                          </div>
                        )}

                        {/* Footer Stats */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="w-3 h-3" />
                              AI Generated
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              // In the future, open a detailed view
                              downloadNotes(note);
                            }}
                          >
                            View Details
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}