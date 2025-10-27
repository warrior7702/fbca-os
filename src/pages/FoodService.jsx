import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { UtensilsCrossed, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FoodService() {
  return (
    <div className="h-full bg-gradient-to-br from-green-50 to-emerald-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={UtensilsCrossed}
          title="Food Service"
          description="Catering orders and menu planning"
          iconColor="from-green-500 to-emerald-500"
          action={
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">Food Service module features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}