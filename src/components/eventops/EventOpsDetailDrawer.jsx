import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export default function EventOpsDetailDrawer({ event, isOpen, onClose, onUpdate }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);

  useEffect(() => {
    if (isOpen && event) {
      loadRooms();
      loadStaff();
    }
  }, [isOpen, event]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const roomsData = await base44.entities.RoomOps.filter({ pco_event_id: event.pco_event_id });
      
      // Sort: alerts first, then by setup_due_at
      const sorted = roomsData.sort((a, b) => {
        const aHasAlert = a.alert_heavy_usage || a.alert_turnaround_before_cleaning || a.alert_saturday_night_priority;
        const bHasAlert = b.alert_heavy_usage || b.alert_turnaround_before_cleaning || b.alert_saturday_night_priority;
        
        if (aHasAlert && !bHasAlert) return -1;
        if (!aHasAlert && bHasAlert) return 1;
        
        return new Date(a.setup_due_at) - new Date(b.setup_due_at);
      });
      
      setRooms(sorted);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const users = await base44.entities.User.list();
      setStaffMembers(users);
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const handleRoomUpdate = async (roomId, updates) => {
    try {
      await base44.entities.RoomOps.update(roomId, updates);
      await loadRooms();
      if (onUpdate) onUpdate();
      toast.success('Room updated');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      'Not Started': <Circle className="w-4 h-4 text-slate-400" />,
      'In Progress': <Clock className="w-4 h-4 text-blue-500" />,
      'Done': <CheckCircle2 className="w-4 h-4 text-green-500" />,
      'Blocked': <AlertTriangle className="w-4 h-4 text-red-500" />
    };
    return icons[status] || icons['Not Started'];
  };

  const getStatusColor = (status) => {
    const colors = {
      'Not Started': 'bg-slate-100 text-slate-700',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Done': 'bg-green-100 text-green-700',
      'Blocked': 'bg-red-100 text-red-700'
    };
    return colors[status] || colors['Not Started'];
  };

  if (!event) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-600" />
            Event Operations Detail
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Event Info */}
          <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
            <h2 className="font-bold text-slate-900 mb-2">{event.event_name}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              <Clock className="w-4 h-4" />
              <span>{format(parseISO(event.starts_at), 'MMM d, yyyy h:mm a')}</span>
              <span>-</span>
              <span>{format(parseISO(event.ends_at), 'h:mm a')}</span>
            </div>
            {event.owner_name && (
              <p className="text-sm text-slate-600">Owner: {event.owner_name}</p>
            )}
            
            {/* Approval Answers */}
            {event.raw_pco?.approval_answers && (
              <div className="mt-3 space-y-2">
                {event.needs_room_setup && Object.keys(event.raw_pco.approval_answers.room_setups || {}).length > 0 && (
                  <div className="bg-blue-50 rounded p-2 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Room Setup Details:</p>
                    {Object.entries(event.raw_pco.approval_answers.room_setups).map(([q, a]) => (
                      <p key={q} className="text-xs text-slate-700">
                        <span className="font-medium">{q}:</span> {a}
                      </p>
                    ))}
                  </div>
                )}
                {event.needs_maintenance && Object.keys(event.raw_pco.approval_answers.maintenance || {}).length > 0 && (
                  <div className="bg-orange-50 rounded p-2 border border-orange-200">
                    <p className="text-xs font-semibold text-orange-900 mb-1">Maintenance Details:</p>
                    {Object.entries(event.raw_pco.approval_answers.maintenance).map(([q, a]) => (
                      <p key={q} className="text-xs text-slate-700">
                        <span className="font-medium">{q}:</span> {a}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rooms List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No rooms found</p>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Rooms ({rooms.length})</h3>
              {rooms.map(room => {
                const hasAlert = room.alert_heavy_usage || 
                               room.alert_turnaround_before_cleaning || 
                               room.alert_saturday_night_priority;
                
                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-lg border-2 ${
                      hasAlert ? 'border-amber-400 bg-amber-50' : 'border-violet-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-600" />
                        <h4 className="font-semibold text-slate-900">{room.room_name}</h4>
                      </div>
                      {hasAlert && (
                        <div className="flex flex-col gap-1">
                          {room.alert_heavy_usage && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                              Heavy Usage
                            </Badge>
                          )}
                          {room.alert_turnaround_before_cleaning && (
                            <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                              Tight Turnaround
                            </Badge>
                          )}
                          {room.alert_saturday_night_priority && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                              Weekend Priority
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Timeline Info */}
                    <div className="space-y-1 mb-3 text-xs text-slate-600">
                      {room.room_available_at && (
                        <p>Available: {format(parseISO(room.room_available_at), 'MMM d, h:mm a')}</p>
                      )}
                      <p>Setup Due: {format(parseISO(room.setup_due_at), 'MMM d, h:mm a')}</p>
                      {room.clean_due_at && (
                        <p>Clean Due: {format(parseISO(room.clean_due_at), 'MMM d, h:mm a')}</p>
                      )}
                    </div>

                    {/* Status Controls */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Setup</label>
                        <Select
                          value={room.status_setup}
                          onValueChange={(val) => handleRoomUpdate(room.id, { status_setup: val })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Done">Done</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Cleaning</label>
                        <Select
                          value={room.status_cleaning}
                          onValueChange={(val) => handleRoomUpdate(room.id, { status_cleaning: val })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Done">Done</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Reset</label>
                        <Select
                          value={room.status_reset}
                          onValueChange={(val) => handleRoomUpdate(room.id, { status_reset: val })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Done">Done</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Assign Staff */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-600 mb-1 block">Assigned To</label>
                      <Select
                        value={room.assigned_to_email || ""}
                        onValueChange={(val) => {
                          const user = staffMembers.find(u => u.email === val);
                          handleRoomUpdate(room.id, {
                            assigned_to_email: val,
                            assigned_to_name: user?.full_name || val
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Unassigned</SelectItem>
                          {staffMembers.map(user => (
                            <SelectItem key={user.id} value={user.email}>
                              {user.full_name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Notes</label>
                      <Textarea
                        defaultValue={room.notes || ""}
                        onChange={(e) => {
                          // Debounced update
                          clearTimeout(window.notesTimeout);
                          window.notesTimeout = setTimeout(() => {
                            handleRoomUpdate(room.id, { notes: e.target.value });
                          }, 1000);
                        }}
                        placeholder="Add notes..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}