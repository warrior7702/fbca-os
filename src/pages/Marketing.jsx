import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Megaphone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Marketing() {
  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-slate-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Megaphone}
          title="Marketing"
          description="Campaign requests and asset management"
          iconColor="from-purple-500 to-pink-500"
          action={
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">Marketing module features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}