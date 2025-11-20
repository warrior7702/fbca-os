import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Video, Hash, Users, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { addMinutes } from "date-fns";

const MEETING_TEMPLATES = [
  { id: "quick-sync", name: "Quick Sync", duration: 15, icon: Zap },
  { id: "one-on-one", name: "1-on-1", duration: 30, icon: Users },
  { id: "team-meeting", name: "Team Meeting", duration: 60, icon: Users },
  { id: "client-call", name: "Client Call", duration: 45, icon: Video }
];

export default function QuickActions() {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const handleInstantMeeting = async () => {
    try {
      setCreatingMeeting(true);
      const now = new Date();
      const endTime = addMinutes(now, 30);
      
      const response = await base44.functions.invoke('sendMeetingRequest', {
        subject: "Quick Meeting",
        startDateTime: now.toISOString(),
        endDateTime: endTime.toISOString(),
        body: "Instant meeting created",
        isOnlineMeeting: true
      });

      if (response.data.success && response.data.joinUrl) {
        window.open(response.data.joinUrl, '_blank');
        toast.success('Meeting created! Opening now...');
      } else {
        toast.error('Failed to create instant meeting');
      }
    } catch (error) {
      console.error('Error creating instant meeting:', error);
      toast.error('Failed to create meeting');
    } finally {
      setCreatingMeeting(false);
    }
  };

  const handleJoinByCode = () => {
    if (!meetingCode.trim()) {
      toast.error('Please enter a meeting code');
      return;
    }

    // Try to detect meeting type and open
    const code = meetingCode.trim();
    
    if (code.includes('teams.microsoft.com')) {
      window.open(code, '_blank');
    } else if (code.match(/^\d{9,11}$/)) {
      // Zoom meeting ID format
      window.open(`https://zoom.us/j/${code}`, '_blank');
    } else if (code.includes('meet.google.com')) {
      window.open(code, '_blank');
    } else {
      // Try as Teams code
      window.open(`https://teams.microsoft.com/l/meetup-join/${code}`, '_blank');
    }
    
    toast.success('Opening meeting...');
    setShowJoinModal(false);
    setMeetingCode("");
  };

  const handleTemplateSelect = async (template) => {
    try {
      setCreatingMeeting(true);
      const now = new Date();
      const endTime = addMinutes(now, template.duration);
      
      const response = await base44.functions.invoke('sendMeetingRequest', {
        subject: template.name,
        startDateTime: now.toISOString(),
        endDateTime: endTime.toISOString(),
        body: `${template.name} - ${template.duration} minutes`,
        isOnlineMeeting: true
      });

      if (response.data.success && response.data.joinUrl) {
        window.open(response.data.joinUrl, '_blank');
        toast.success(`${template.name} created!`);
      } else {
        toast.error('Failed to create meeting');
      }
    } catch (error) {
      console.error('Error creating meeting from template:', error);
      toast.error('Failed to create meeting');
    } finally {
      setCreatingMeeting(false);
      setShowTemplateModal(false);
    }
  };

  return (
    <>
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={handleInstantMeeting}
              disabled={creatingMeeting}
              className="bg-purple-600 hover:bg-purple-700 h-auto py-4 flex-col gap-2"
            >
              <Video className="w-5 h-5" />
              <span className="text-sm">Start Instant Meeting</span>
            </Button>

            <Button
              onClick={() => setShowJoinModal(true)}
              variant="outline"
              className="h-auto py-4 flex-col gap-2 border-2 border-purple-200 hover:bg-purple-50"
            >
              <Hash className="w-5 h-5" />
              <span className="text-sm">Join by Code</span>
            </Button>

            <Button
              onClick={() => setShowTemplateModal(true)}
              variant="outline"
              className="h-auto py-4 flex-col gap-2 border-2 border-purple-200 hover:bg-purple-50"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm">Use Template</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Join by Code Modal */}
      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Meeting by Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Meeting Code or Link</label>
              <Input
                placeholder="Enter Teams/Zoom code or meeting link..."
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinByCode()}
              />
            </div>
            <Button onClick={handleJoinByCode} className="w-full bg-purple-600 hover:bg-purple-700">
              Join Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Meeting Template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {MEETING_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <Button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  disabled={creatingMeeting}
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 border-2 hover:border-purple-400 hover:bg-purple-50"
                >
                  <Icon className="w-6 h-6 text-purple-600" />
                  <span className="font-semibold">{template.name}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {template.duration} min
                  </span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}