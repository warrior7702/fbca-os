import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Play, Pause, User, X } from "lucide-react";
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

export default function AudioTranscriptPlayer({ 
  audioUrl, 
  segments = [],
  onAssignSpeaker,
  onRemoveSpeaker,
  staffResults = [],
  onSearchStaff
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    if (playing) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAssignSpeaker = (segmentIndex, person) => {
    if (onAssignSpeaker) {
      onAssignSpeaker(segmentIndex, person);
    }
    setEditingSegmentIndex(null);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Audio Player Controls */}
      <Card className="p-4 bg-slate-50">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={togglePlayPause}
            className="w-10 h-10 p-0"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <div className="flex-1">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Transcript Segments */}
      <div className="space-y-3">
        {segments.map((segment, idx) => (
          <div
            key={idx}
            className="group p-4 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {segment.speaker_name ? (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                      <User className="w-3 h-3 mr-1" />
                      {segment.speaker_name}
                    </Badge>
                    {onRemoveSpeaker && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemoveSpeaker(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  onAssignSpeaker && (
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
                  )
                )}
                <p className="text-slate-700 leading-relaxed">{segment.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}