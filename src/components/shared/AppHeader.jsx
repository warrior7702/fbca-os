import React from "react";
import { Button } from "@/components/ui/button";

export default function AppHeader({ 
  icon: Icon, 
  title, 
  description, 
  iconColor = "from-blue-500 to-indigo-500",
  action 
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 bg-gradient-to-br ${iconColor} rounded-xl shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <div className="text-slate-600">{description}</div>
        </div>
      </div>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}