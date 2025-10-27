import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Ticket, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Ticketing() {
  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Ticket}
          title="Ticketing"
          description="Manage support tickets and requests"
          iconColor="from-amber-500 to-yellow-500"
          action={
            <Button className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">Ticketing system features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}