import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function FullApprovalCalendarModal({ isOpen, onClose, approvals, onApprovalClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getApprovalsForDay = (day) => {
    return approvals.filter(approval => {
      if (!approval.event_starts_at) return false;
      const eventDate = new Date(approval.event_starts_at);
      return isSameDay(eventDate, day);
    });
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              {format(currentMonth, 'MMMM yyyy')}
            </DialogTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={previousMonth}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Today
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextMonth}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const dayApprovals = getApprovalsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={idx}
                  className={`min-h-[120px] p-3 rounded-lg border-2 transition-all ${
                    isToday
                      ? 'border-orange-500 bg-orange-50 shadow-md'
                      : dayApprovals.length > 0 && isCurrentMonth
                      ? 'border-green-300 bg-green-50 hover:border-green-500 hover:shadow-md'
                      : isCurrentMonth
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className={`text-sm font-bold mb-2 ${
                    isToday
                      ? 'text-orange-600'
                      : isCurrentMonth
                      ? 'text-slate-900'
                      : 'text-slate-400'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  {dayApprovals.length > 0 && (
                    <div className="space-y-1">
                      {dayApprovals.slice(0, 3).map((approval, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            onApprovalClick(approval);
                            onClose();
                          }}
                          className="text-xs p-1.5 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer truncate font-medium"
                          title={`${approval.event_name} - ${approval.resource_name}`}
                        >
                          {approval.event_name}
                        </div>
                      ))}
                      {dayApprovals.length > 3 && (
                        <Badge className="w-full bg-green-700 text-white text-xs justify-center">
                          +{dayApprovals.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}