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
  Download,
  X
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function DetailedMeetingNotesModal({ 
  open, 
  onOpenChange, 
  note, 
  onUpdateSegmentSpeaker,
  staffResults = [],
  onSearchStaff
}) {
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!note) return null;

  const handleAssignSpeaker = (segmentIndex, person) => {
    if (onUpdateSegmentSpeaker) {
      onUpdateSegmentSpeaker(segmentIndex, person);
    }
    setEditingSegmentIndex(null);
    setSearchQuery('');
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

          {/* Transcript with Speaker Assignment */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Transcript</h3>
              <Badge variant="secondary" className="ml-auto">
                {note.transcript_segments?.length || 0} segments
              </Badge>
            </div>

            <div className="space-y-3">
              {note.transcript_segments && note.transcript_segments.length > 0 ? (
                note.transcript_segments.map((segment, idx) => (
                  <div
                    key={idx}
                    className="group p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {segment.speaker_name ? (
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                              <User className="w-3 h-3 mr-1" />
                              {segment.speaker_name}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveSpeaker(idx)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Popover 
                            open={editingSegmentIndex === idx} 
                            onOpenChange={(open) => !open && setEditingSegmentIndex(null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditingSegmentIndex(idx);
                                  if (onSearchStaff) onSearchStaff('');
                                }}
                              >
                                <User className="w-3 h-3 mr-2" />
                                Assign Speaker
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search for speaker..." 
                                  value={searchQuery}
                                  onValueChange={(value) => {
                                    setSearchQuery(value);
                                    if (onSearchStaff) onSearchStaff(value);
                                  }}
                                />
                                <CommandList>
                                  <CommandEmpty>No staff found</CommandEmpty>
                                  <CommandGroup>
                                    {staffResults.map((person) => (
                                      <CommandItem
                                        key={person.id}
                                        onSelect={() => handleAssignSpeaker(idx, person)}
                                      >
                                        <User className="w-4 h-4 mr-2" />
                                        <div>
                                          <p className="font-medium">{person.displayName}</p>
                                          <p className="text-xs text-slate-500">{person.mail || person.userPrincipalName}</p>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                        <p className="text-slate-700 leading-relaxed">{segment.text}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500">
                  <p>No transcript segments available</p>
                  {note.transcript && (
                    <p className="text-xs mt-2">View full transcript in the main notes view</p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}