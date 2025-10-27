import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const personnelOptions = [
  { value: "unlock", label: "Unlock", color: "#2ecd6f" },
  { value: "young_adult", label: "Young Adult Event", color: "#e50000" },
  { value: "preschool", label: "Preschool Event", color: "#EA80FC" },
  { value: "youth", label: "Youth Event", color: "#FF4081" },
  { value: "children", label: "Children's Event", color: "#04A9F4" },
  { value: "global", label: "Global Ministry", color: "#E65100" },
  { value: "college", label: "College Event", color: "#0231E8" },
  { value: "other", label: "Other", color: "#667684" }
];

const buildingOptions = [
  { value: "FBC", label: "FBC", color: "#3082B7" },
  { value: "PCB", label: "PCB", color: "#ff7800" },
  { value: "STUDENT_CENTER", label: "Student Center", color: "#81B1FF" },
  { value: "Wade", label: "Wade", color: "#9b59b6" }
];

export default function ApprovalFormModal({ open, onClose, approval, onSubmit, submitting }) {
  const [formData, setFormData] = useState({
    access_type: "",
    entrance: "",
    badge_code: "",
    start_time: "",
    end_time: "",
    buildings: [],
    personnel: "",
    doors: "",
    notes: ""
  });

  // Auto-fill data when approval changes
  useEffect(() => {
    if (approval) {
      // Try to extract building from resource name or event name
      const resourceName = approval.resource_name || "";
      const detectedBuildings = [];
      
      if (resourceName.includes("FBC") || resourceName.includes("Fellowship")) {
        detectedBuildings.push("FBC");
      }
      if (resourceName.includes("PCB") || resourceName.includes("Preschool")) {
        detectedBuildings.push("PCB");
      }
      if (resourceName.includes("Student") || resourceName.includes("Wade")) {
        detectedBuildings.push("STUDENT_CENTER");
      }

      // Pre-fill times from event
      let startTime = "";
      let endTime = "";
      if (approval.event_starts_at) {
        const start = new Date(approval.event_starts_at);
        startTime = format(start, 'h:mm a');
      }
      if (approval.event_ends_at) {
        const end = new Date(approval.event_ends_at);
        endTime = format(end, 'h:mm a');
      }

      setFormData({
        access_type: "Door Code",
        entrance: "",
        badge_code: "",
        start_time: startTime,
        end_time: endTime,
        buildings: detectedBuildings,
        personnel: "",
        doors: "",
        notes: ""
      });
    }
  }, [approval]);

  const handleBuildingToggle = (building) => {
    setFormData(prev => ({
      ...prev,
      buildings: prev.buildings.includes(building)
        ? prev.buildings.filter(b => b !== building)
        : [...prev.buildings, building]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Approve Access Request
          </DialogTitle>
          <div className="text-sm text-slate-600 mt-2">
            <p className="font-semibold">{approval.event_name}</p>
            {approval.event_starts_at && (
              <p>{format(new Date(approval.event_starts_at), 'EEEE, MMMM d, yyyy')}</p>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Access Type */}
          <div className="space-y-2">
            <Label htmlFor="access_type">What type of access do you need? *</Label>
            <Input
              id="access_type"
              value={formData.access_type}
              onChange={(e) => setFormData({ ...formData, access_type: e.target.value })}
              placeholder="e.g., Door Code"
              required
            />
          </div>

          {/* Entrance */}
          <div className="space-y-2">
            <Label htmlFor="entrance">What entrance will your guest enter? *</Label>
            <Input
              id="entrance"
              value={formData.entrance}
              onChange={(e) => setFormData({ ...formData, entrance: e.target.value })}
              placeholder="e.g., Courtyard - Fellowship Hall, South Entrance, PCB"
              required
            />
          </div>

          {/* Badge/Code */}
          <div className="space-y-2">
            <Label htmlFor="badge_code">Do you want a specific badge or code?</Label>
            <Input
              id="badge_code"
              value={formData.badge_code}
              onChange={(e) => setFormData({ ...formData, badge_code: e.target.value })}
              placeholder="e.g., Quilter's Building Code"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                placeholder="7:00 am"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                placeholder="1:30 pm"
                required
              />
            </div>
          </div>

          {/* Buildings */}
          <div className="space-y-2">
            <Label>Building(s)</Label>
            <div className="flex flex-wrap gap-2">
              {buildingOptions.map((building) => (
                <Badge
                  key={building.value}
                  onClick={() => handleBuildingToggle(building.value)}
                  className={`cursor-pointer transition-all ${
                    formData.buildings.includes(building.value)
                      ? 'opacity-100 ring-2 ring-offset-2'
                      : 'opacity-50'
                  }`}
                  style={{ backgroundColor: building.color }}
                >
                  {building.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Personnel/Event Type */}
          <div className="space-y-2">
            <Label htmlFor="personnel">Personnel / Event Type</Label>
            <Select
              value={formData.personnel}
              onValueChange={(value) => setFormData({ ...formData, personnel: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type..." />
              </SelectTrigger>
              <SelectContent>
                {personnelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Doors */}
          <div className="space-y-2">
            <Label htmlFor="doors">Specific Doors</Label>
            <Input
              id="doors"
              value={formData.doors}
              onChange={(e) => setFormData({ ...formData, doors: e.target.value })}
              placeholder="List specific doors if needed"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve & Create Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}