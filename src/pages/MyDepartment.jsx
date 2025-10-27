import React from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Building2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyDepartment() {
  return (
    <div className="h-full bg-gradient-to-br from-violet-50 to-purple-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Building2}
          title="My Department"
          description="Department resources, team info, and workflows"
          iconColor="from-violet-500 to-purple-600"
          action={
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Users className="w-4 h-4 mr-2" />
              View Team
            </Button>
          }
        />

        <Card className="p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h3>
          <p className="text-slate-600">Department features will be added here.</p>
        </Card>
      </div>
    </div>
  );
}