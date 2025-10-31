import React, { useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import FullApprovalCalendarModal from "./FullApprovalCalendarModal";

export default function ApprovalCalendar({ approvals, onApprovalClick }) {
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  
  // Get next 2 weeks from today (static)
  const today = new Date();
  const twoWeekDays = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const getApprovalsForDay = (day) => {
    return approvals.filter(approval => {
      if (!approval.event_starts_at) return false;
      const eventDate = new Date(approval.event_starts_at);
      return isSameDay(eventDate, day);
    });
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-1">Next 2 Weeks</h3>
            <p className="text-sm text-slate-600">{approvals.length} approved request{approvals.length !== 1 ? 's' : ''}</p>
          </div>
          
          <Button
            onClick={() => setShowFullCalendar(true)}
            variant="outline"
            className="border-orange-300 hover:bg-orange-50 gap-2"
          >
            <CalendarIcon className="w-4 h-4" />
            View Full Calendar
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-3">
          {twoWeekDays.map((day, idx) => {
            const dayApprovals = getApprovalsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isToday 
                    ? 'border-orange-500 bg-orange-50 shadow-md' 
                    : dayApprovals.length > 0
                    ? 'border-green-300 bg-green-50 hover:border-green-500 hover:shadow-md cursor-pointer'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="text-center mb-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-2xl font-bold ${
                    isToday ? 'text-orange-600' : 'text-slate-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {format(day, 'MMM')}
                  </div>
                </div>
                
                {dayApprovals.length > 0 && (
                  <div className="space-y-1.5">
                    <Badge className="w-full bg-green-600 text-white text-xs justify-center">
                      {dayApprovals.length} event{dayApprovals.length !== 1 ? 's' : ''}
                    </Badge>
                    {dayApprovals.slice(0, 2).map((approval, idx) => (
                      <div
                        key={idx}
                        onClick={() => onApprovalClick(approval)}
                        className="text-xs p-2 bg-white rounded border border-green-300 hover:bg-green-50 cursor-pointer truncate font-medium text-slate-700"
                        title={approval.event_name}
                      >
                        {approval.event_name}
                      </div>
                    ))}
                    {dayApprovals.length > 2 && (
                      <div className="text-xs text-slate-500 text-center font-medium">
                        +{dayApprovals.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Full Calendar Modal */}
      <FullApprovalCalendarModal
        isOpen={showFullCalendar}
        onClose={() => setShowFullCalendar(false)}
        approvals={approvals}
        onApprovalClick={onApprovalClick}
      />
    </>
  );
}