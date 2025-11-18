
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  User, 
  Users,
  MessageSquare,
  Download, // Download icon is imported but not used in the final code, keeping for consistency with original file.
  X // X icon is imported but not used in the final code, keeping for consistency with original file.
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { // Command components are imported but not used in the final code, keeping for consistency with original file.
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { // Popover components are imported but not used in the final code, keeping for consistency with original file.
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AudioTranscriptPlayer from "./AudioTranscriptPlayer"; // New import

export default function DetailedMeetingNotesModal({ 
  open, 
  onOpenChange, 
  note, 
  onUpdateSegmentSpeaker,
  staffResults = [],
  onSearchStaff
}) {
  // Removed useState for editingSegmentIndex and searchQuery as their logic is moved into AudioTranscriptPlayer

  if (!note) return null;

  const handleAssignSpeaker = (segmentIndex, person) => {
    if (onUpdateSegmentSpeaker) {
      onUpdateSegmentSpeaker(segmentIndex, person);
    }
    // Removed setEditingSegmentIndex(null) and setSearchQuery('') as state management is now within AudioTranscriptPlayer
  };

  const handleRemoveSpeaker = (segmentIndex) => {
    if (onUpdateSegmentSpeaker) {
      onUpdateSegmentSpeaker(segmentIndex, null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl pr-8">
            {note.meeting_subject}
          </DialogTitle>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-2">
            <span>{format(parseISO(note.meeting_date), 'PPp')}</span>
            {note.recording_duration && (
              <span>• {Math.floor(note.recording_duration / 60)}:{(note.recording_duration % 60).toString().padStart(2, '0')}</span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Speakers */}
          {note.speakers && note.speakers.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900">Speakers</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {note.speakers.map((speaker, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1">
                    <User className="w-3 h-3" />
                    {speaker.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Audio Player with Transcript */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Audio & Transcript</h3>
              <Badge variant="secondary" className="ml-auto">
                {note.transcript_segments?.length || 0} segments
              </Badge>
            </div>

            {note.audio_url ? (
              <AudioTranscriptPlayer
                audioUrl={note.audio_url}
                segments={note.transcript_segments || []}
                onAssignSpeaker={handleAssignSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                staffResults={staffResults}
                onSearchStaff={onSearchStaff}
              />
            ) : (
              <div className="p-6 text-center text-slate-500">
                <p>No audio available</p>
              </div>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
