import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Flame, ThermometerSun, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CleaningAcknowledgeModal({ open, onOpenChange, room, warning, onAcknowledged }) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      
      await base44.functions.invoke('acknowledgeRoomWarning', {
        room_id: room.id,
        user_id: user.email,
        user_name: user.full_name,
        notes: notes || null
      });

      toast.success("Cleaning plan acknowledged");
      
      if (onAcknowledged) {
        onAcknowledged();
      }
      
      onOpenChange(false);
      setNotes("");
    } catch (error) {
      console.error("Acknowledge error:", error);
      toast.error("Failed to acknowledge: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTemperatureIcon = (temp) => {
    switch(temp) {
      case 'HOT': return <Flame className="w-5 h-5 text-red-500" />;
      case 'WARM': return <ThermometerSun className="w-5 h-5 text-orange-500" />;
      case 'COOL': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getTemperatureColor = (temp) => {
    switch(temp) {
      case 'HOT': return 'bg-red-50 border-red-200';
      case 'WARM': return 'bg-orange-50 border-orange-200';
      case 'COOL': return 'bg-green-50 border-green-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  if (!room || !warning) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTemperatureIcon(warning.temperature)}
            Set Cleaning Plan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room Info */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="font-semibold text-slate-900">{room.room_name}</div>
            <div className="text-sm text-slate-600">{room.room_number}</div>
            {room.building_name && (
              <div className="text-xs text-slate-500 mt-1">
                {room.building_name} {room.floor_name && `• ${room.floor_name}`}
              </div>
            )}
          </div>

          {/* Warning Summary */}
          <div className={`rounded-lg p-3 border ${getTemperatureColor(warning.temperature)}`}>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-slate-700" />
              <div className="flex-1">
                <div className="font-medium text-slate-900 mb-1">Cleaning Required</div>
                <div className="text-sm text-slate-700">{warning.text}</div>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the cleaning plan..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAcknowledge}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Acknowledging...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Acknowledge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}