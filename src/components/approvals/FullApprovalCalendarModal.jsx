
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isToday, startOfDay, parseISO } from "date-fns";

export default function FullApprovalCalendarModal({ open, onOpenChange, approvals, calendarEvents }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const generateMonthDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const monthDays = generateMonthDays();

  // Group approvals by date
  const approvalsByDate = {};
  approvals.forEach((approval) => {
    const dateStr = approval.attributes?.starts_at || approval.attributes?.created_at;
    if (dateStr) {
      try {
        const date = parseISO(dateStr);
        const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
        if (!approvalsByDate[dateKey]) {
          approvalsByDate[dateKey] = [];
        }
        approvalsByDate[dateKey].push(approval);
      } catch (error) {
        console.error('Error parsing approval date:', error);
      }
    }
  });

  // Group calendar events by date
  const eventsByDate = {};
  (calendarEvents || []).forEach((event) => {
    if (event.starts_at) {
      try {
        const date = parseISO(event.starts_at);
        const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      } catch (error) {
        console.error('Error parsing event date:', error);
      }
    }
  });

  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-3xl font-bold">
              {format(currentMonth, 'MMMM yyyy')} - Calendar
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div key={day} className="p-3 text-center font-semibold text-slate-700 border-r last:border-r-0 text-sm">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Weeks */}
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((day, dayIdx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayApprovals = approvalsByDate[dateKey] || [];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isTodayDate = isToday(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={dayIdx}
                      className={`min-h-[140px] p-2 border-r last:border-r-0 ${
                        isTodayDate ? 'bg-orange-50 ring-2 ring-inset ring-orange-500' : isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`text-base font-semibold mb-2 ${
                        isTodayDate ? 'text-orange-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-1">
                        {/* Show pending approvals */}
                        {dayApprovals.map((approval, idx) => (
                          <div
                            key={`approval-${idx}`}
                            className="text-xs p-1.5 rounded-md bg-orange-100 border border-orange-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-1 mb-0.5">
                              <AlertCircle className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-orange-900 leading-tight">
                                  {approval.event_name}
                                </div>
                                {approval.resource_name && (
                                  <div className="text-[9px] text-orange-700 truncate mt-0.5">
                                    {approval.resource_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Show regular events */}
                        {dayEvents.map((event, idx) => (
                          <div
                            key={`event-${idx}`}
                            className="text-xs p-1.5 rounded-md bg-blue-50 border border-blue-200 hover:shadow-md transition-all"
                          >
                            <div className="font-medium truncate text-blue-900 leading-tight">
                              {event.name}
                            </div>
                            {event.starts_at && (
                              <div className="text-[9px] text-blue-600 mt-0.5">
                                {format(parseISO(event.starts_at), 'h:mm a')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
