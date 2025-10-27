import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Inbox, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InboxHelper() {
  return (
    <div className="h-full bg-gradient-to-br from-rose-50 to-pink-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Inbox}
          title="Inbox Helper"
          description="AI-powered email management and organization"
          iconColor="from-rose-500 to-pink-600"
          action={
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze Inbox
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">AI inbox assistant features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}