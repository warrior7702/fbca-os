import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Download, 
  Sparkles, 
  ListChecks, 
  Users, 
  MessageSquare,
  CheckCircle2,
  User,
  Search,
  X,
  Eye,
  Trash2 // Added Trash2 icon
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

export default function EnhancedMeetingNotes({ 
  notes, 
  onDownload, 
  onDelete, // Added onDelete prop
  staffResults = [], 
  onSearchStaff, 
  onAssignPerson,
  onViewDetails 
}) {
  const [assigningIndex, setAssigningIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAssign = (actionItemIndex, person) => {
    if (onAssignPerson) {
      onAssignPerson(actionItemIndex, person);
    }
    setAssigningIndex(null);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Header with Download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {notes.meeting_subject || 'Meeting Notes'}
            </h3>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>{format(parseISO(notes.meeting_date), 'PPp')}</span>
              {notes.recording_duration && (
                <span>• {Math.floor(notes.recording_duration / 60)}:{(notes.recording_duration % 60).toString().padStart(2, '0')}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={onViewDetails}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Transcript
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          {onDelete && ( // Conditionally render Delete button
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Speakers */}
      {notes.speakers && notes.speakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Speakers ({notes.speakers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {notes.speakers.map((speaker, idx) => (
                <Badge key={idx} variant="outline" className="gap-1">
                  <User className="w-3 h-3" />
                  {speaker.name}
                  {speaker.email && (
                    <span className="text-xs text-slate-500 ml-1">({speaker.email})</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {notes.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed">{notes.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Points */}
      {notes.key_points && notes.key_points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Key Discussion Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {notes.key_points.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Outline */}
      {notes.outline && notes.outline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-purple-600" />
              Meeting Outline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notes.outline.map((section, idx) => (
                <div key={idx} className="border-l-2 border-purple-200 pl-4 py-1">
                  <h4 className="font-semibold text-slate-900 mb-1">{section.topic}</h4>
                  <p className="text-sm text-slate-600">{section.details}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {notes.action_items && notes.action_items.length > 0 && (
        <Card className="border-2 border-amber-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              Action Items ({notes.action_items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notes.action_items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex-1">
                    <p className="text-slate-900 font-medium mb-1">
                      {typeof item === 'string' ? item : item.task}
                    </p>
                    {(typeof item === 'object' && item.assigned_to) ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <User className="w-3 h-3 mr-1" />
                          {item.assigned_to}
                        </Badge>
                        {onAssignPerson && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAssigningIndex(idx)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      onAssignPerson && (
                        <Popover open={assigningIndex === idx} onOpenChange={(open) => !open && setAssigningIndex(null)}>
                          <PopoverTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssigningIndex(idx)}
                            >
                              <User className="w-3 h-3 mr-2" />
                              Assign
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search staff..." 
                                value={searchQuery}
                                onValueChange={(value) => {
                                  setSearchQuery(value);
                                  onSearchStaff(value);
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>No staff found</CommandEmpty>
                                <CommandGroup>
                                  {staffResults.map((person) => (
                                    <CommandItem
                                      key={person.id}
                                      onSelect={() => handleAssign(idx, person)}
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
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="gap-1">
          <Sparkles className="w-3 h-3" />
          Generated with AI
        </Badge>
      </div>
    </div>
  );
}