import React from "react";
import { UtensilsCrossed, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FoodService() {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <UtensilsCrossed className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Food Service</h1>
              <p className="text-slate-600">Catering orders and menu planning</p>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">Food Service module features will be added here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}