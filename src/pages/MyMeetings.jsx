import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Video, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyMeetings() {
  return (
    <div className="h-full bg-gradient-to-br from-cyan-50 to-blue-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Video}
          title="My Meetings"
          description="Schedule and manage video meetings"
          iconColor="from-cyan-500 to-blue-600"
          action={
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">Meeting management features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}