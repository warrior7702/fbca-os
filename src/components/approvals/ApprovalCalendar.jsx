
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Maximize2, AlertCircle } from "lucide-react";
import { format, addDays, startOfWeek, isToday, startOfDay, parseISO } from "date-fns";

export default function ApprovalCalendar({ approvals, calendarEvents, onOpenFullView }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const generateTwoWeeks = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  };

  const twoWeeksDays = generateTwoWeeks();

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
  calendarEvents.forEach((event) => {
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

  const goToPreviousWeeks = () => {
    setCurrentWeekStart(prev => addDays(prev, -14));
  };

  const goToNextWeeks = () => {
    setCurrentWeekStart(prev => addDays(prev, 14));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const week1 = twoWeeksDays.slice(0, 7);
  const week2 = twoWeeksDays.slice(7, 14);

  const renderDay = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayApprovals = approvalsByDate[dateKey] || [];
    const dayEvents = eventsByDate[dateKey] || [];
    const isTodayDate = isToday(day);

    return (
      <Card key={dateKey} className={`overflow-hidden transition-all hover:shadow-md ${isTodayDate ? 'ring-2 ring-orange-500 shadow-lg' : ''}`}>
        <CardContent className="p-0">
          <div className={`p-3 text-center border-b ${isTodayDate ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{format(day, 'EEE')}</div>
            <div className={`text-2xl font-bold ${isTodayDate ? 'text-orange-600' : 'text-slate-900'}`}>
              {format(day, 'd')}
            </div>
          </div>
          
          <div className="p-2 space-y-1.5 min-h-[120px]">
            {/* Show pending approvals first */}
            {dayApprovals.slice(0, 2).map((approval, idx) => (
              <div
                key={`approval-${idx}`}
                className="text-xs p-2 rounded-md bg-orange-100 border border-orange-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-1.5 mb-1">
                  <AlertCircle className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="flex-1 font-medium leading-tight text-orange-900">
                    {approval.event_name}
                  </span>
                </div>
                {approval.resource_name && (
                  <div className="text-[10px] text-orange-700 truncate ml-4">
                    {approval.resource_name}
                  </div>
                )}
              </div>
            ))}

            {/* Show regular calendar events */}
            {dayEvents.slice(0, 3 - dayApprovals.length).map((event, idx) => (
              <div
                key={`event-${idx}`}
                className="text-xs p-2 rounded-md bg-blue-50 border border-blue-200 hover:shadow-md transition-all"
              >
                <div className="font-medium leading-tight text-blue-900 truncate">
                  {event.name}
                </div>
                {event.starts_at && (
                  <div className="text-[10px] text-blue-600 mt-0.5">
                    {format(parseISO(event.starts_at), 'h:mm a')}
                  </div>
                )}
              </div>
            ))}

            {(dayApprovals.length + dayEvents.length) > 3 && (
              <div className="text-xs text-slate-500 text-center font-medium pt-1">
                +{(dayApprovals.length + dayEvents.length) - 3} more
              </div>
            )}
            
            {dayApprovals.length === 0 && dayEvents.length === 0 && (
              <div className="text-xs text-slate-300 text-center py-8">
                No events
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeeks} className="h-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="default" size="sm" onClick={goToToday} className="h-8 bg-blue-600 hover:bg-blue-700">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeeks} className="h-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFullView} className="h-8">
          <Maximize2 className="w-4 h-4 mr-2" />
          Full View
        </Button>
      </div>

      {/* Week 1 */}
      <div className="grid grid-cols-7 gap-3">
        {week1.map(renderDay)}
      </div>

      {/* Week 2 */}
      <div className="grid grid-cols-7 gap-3">
        {week2.map(renderDay)}
      </div>
    </div>
  );
}
