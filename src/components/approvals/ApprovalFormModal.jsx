import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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

const scheduleOptions = [
  { value: "advanced_unlock", label: "Advanced (Unlock)" },
  { value: "weekly_event", label: "Weekly Event" },
  { value: "committee_meetings", label: "Committee Meetings" },
  { value: "rehearsals", label: "Rehearsals" },
  { value: "bible_studies", label: "Bible Studies" },
  { value: "other", label: "Other" }
];

// Extract email from text
const extractEmail = (text) => {
  if (!text) return "";
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = text.match(emailRegex);
  return match ? match[0] : "";
};

// Find answer by question text (case-insensitive partial match)
const findAnswer = (questions, answers, searchTerms) => {
  if (!questions || !answers) return null;
  
  const question = questions.find(q => {
    const questionText = (q.question || "").toLowerCase();
    return searchTerms.some(term => questionText.includes(term.toLowerCase()));
  });
  
  return question ? answers[question.id] : null;
};

export default function ApprovalFormModal({ open, onClose, approval, approvalDetails, onSubmit, submitting }) {
  const [formData, setFormData] = useState({
    access_type: "",
    entrance: "",
    badge_code: "",
    start_time: "",
    end_time: "",
    buildings: [],
    schedule: "",
    personnel: "",
    requestor_email: "",
    doors: "",
    notes: ""
  });

  // Smart auto-fill when approval or details change
  useEffect(() => {
    if (!approval) return;

    const details = approvalDetails || {};
    const questions = details.questions || [];
    const answers = details.answers || {};
    const event = details.event || {};

    // Extract email from event description or summary
    let email = extractEmail(event.description) || extractEmail(event.summary) || "";

    // Try to get answers from PCO questions
    const accessType = findAnswer(questions, answers, ["type of access", "access type"]) || "Door Code";
    const entrance = findAnswer(questions, answers, ["entrance", "enter"]) || "";
    const badgeCode = findAnswer(questions, answers, ["badge", "code", "specific badge"]) || "";
    const timeRange = findAnswer(questions, answers, ["time", "begin and end", "access time"]) || "";
    const doorsAnswer = findAnswer(questions, answers, ["doors", "specific doors"]) || "";
    const notesAnswer = findAnswer(questions, answers, ["notes", "additional", "comments"]) || event.description || "";

    // Parse time range if provided (e.g., "7:00 am - 1:30 pm")
    let startTime = "";
    let endTime = "";
    
    if (timeRange && timeRange.includes("-")) {
      const parts = timeRange.split("-").map(t => t.trim());
      startTime = parts[0] || "";
      endTime = parts[1] || "";
    }
    
    // Fallback to event times
    if (!startTime && approval.event_starts_at) {
      startTime = format(new Date(approval.event_starts_at), 'h:mm a');
    }
    if (!endTime && approval.event_ends_at) {
      endTime = format(new Date(approval.event_ends_at), 'h:mm a');
    }

    // Detect buildings from resource name
    const resourceName = approval.resource_name || "";
    const detectedBuildings = [];
    
    if (resourceName.toLowerCase().includes("fbc") || resourceName.toLowerCase().includes("fellowship")) {
      detectedBuildings.push("FBC");
    }
    if (resourceName.toLowerCase().includes("pcb") || resourceName.toLowerCase().includes("preschool")) {
      detectedBuildings.push("PCB");
    }
    if (resourceName.toLowerCase().includes("student") || resourceName.toLowerCase().includes("wade")) {
      detectedBuildings.push("STUDENT_CENTER");
    }

    // Detect schedule/personnel type from event name or description
    let schedule = "";
    let personnel = "";
    const eventText = `${approval.event_name} ${event.description || ""}`.toLowerCase();
    
    if (eventText.includes("unlock") || eventText.includes("advanced")) {
      schedule = "advanced_unlock";
      personnel = "unlock";
    } else if (eventText.includes("weekly")) {
      schedule = "weekly_event";
    } else if (eventText.includes("committee") || eventText.includes("meeting")) {
      schedule = "committee_meetings";
    } else if (eventText.includes("rehearsal")) {
      schedule = "rehearsals";
    } else if (eventText.includes("bible study")) {
      schedule = "bible_studies";
    } else if (eventText.includes("youth")) {
      personnel = "youth";
    } else if (eventText.includes("children")) {
      personnel = "children";
    } else if (eventText.includes("preschool")) {
      personnel = "preschool";
    } else if (eventText.includes("college")) {
      personnel = "college";
    } else if (eventText.includes("young adult")) {
      personnel = "young_adult";
    } else if (eventText.includes("global")) {
      personnel = "global";
    }

    setFormData({
      access_type: accessType,
      entrance: entrance,
      badge_code: badgeCode,
      start_time: startTime,
      end_time: endTime,
      buildings: detectedBuildings,
      schedule: schedule,
      personnel: personnel,
      requestor_email: email,
      doors: doorsAnswer,
      notes: notesAnswer
    });
  }, [approval, approvalDetails]);

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Building Access Request
          </DialogTitle>
          <div className="text-sm text-slate-600 mt-2">
            <p className="font-semibold">{approval.event_name}</p>
            {approval.event_starts_at && (
              <p>{format(new Date(approval.event_starts_at), 'EEEE, MMMM d, yyyy @ h:mm a')}</p>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Row 1: Access Type & Code */}
          <div className="grid grid-cols-2 gap-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="badge_code">CODE (Badge or Code)</Label>
              <Input
                id="badge_code"
                value={formData.badge_code}
                onChange={(e) => setFormData({ ...formData, badge_code: e.target.value })}
                placeholder="e.g., Quilter's Building Code"
              />
            </div>
          </div>

          {/* Row 2: Entrance & Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entrance">What entrance will your guest enter? *</Label>
              <Input
                id="entrance"
                value={formData.entrance}
                onChange={(e) => setFormData({ ...formData, entrance: e.target.value })}
                placeholder="e.g., Courtyard - Fellowship Hall"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule / Event Type</Label>
              <Select
                value={formData.schedule}
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule type..." />
                </SelectTrigger>
                <SelectContent>
                  {scheduleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Time Range */}
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

          {/* Row 4: Buildings */}
          <div className="space-y-2">
            <Label>BUILDINGS</Label>
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

          {/* Row 5: Requestor Email & Personnel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requestor_email">REQUESTOR EMAIL</Label>
              <Input
                id="requestor_email"
                type="email"
                value={formData.requestor_email}
                onChange={(e) => setFormData({ ...formData, requestor_email: e.target.value })}
                placeholder="email@fbca.org"
              />
            </div>

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
          </div>

          {/* Row 6: Doors */}
          <div className="space-y-2">
            <Label htmlFor="doors">Doors</Label>
            <Input
              id="doors"
              value={formData.doors}
              onChange={(e) => setFormData({ ...formData, doors: e.target.value })}
              placeholder="List specific doors if needed"
            />
          </div>

          {/* Row 7: Notes (Full Width) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Note Info</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information..."
              rows={4}
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