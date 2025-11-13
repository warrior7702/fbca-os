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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 sm:p-3 bg-gradient-to-br ${iconColor} rounded-xl shadow-lg`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
          <div className="text-sm sm:text-base text-slate-600">{description}</div>
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}