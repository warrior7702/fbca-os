import React, { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";

export default function ApprovalCalendar({ approvals, onApprovalClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDay, setHoveredDay] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get calendar grid (includes days from prev/next month to fill weeks)
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get next 2 weeks from today
  const today = new Date();
  const twoWeeksFromToday = addDays(today, 14);
  const twoWeekDays = eachDayOfInterval({ start: today, end: twoWeeksFromToday });

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
    <div className="space-y-6">
      {/* Next 2 Weeks View */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Next 2 Weeks - Approved Requests</h3>
          <Badge variant="outline">{approvals.length} total</Badge>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {twoWeekDays.map((day, idx) => {
            const dayApprovals = getApprovalsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isToday 
                    ? 'border-orange-500 bg-orange-50' 
                    : dayApprovals.length > 0
                    ? 'border-green-200 bg-green-50 hover:border-green-400 cursor-pointer'
                    : 'border-slate-200 bg-white'
                }`}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <div className="text-center">
                  <div className="text-xs text-slate-500 font-medium">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold ${
                    isToday ? 'text-orange-600' : 'text-slate-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {dayApprovals.length > 0 && (
                    <Badge className="mt-1 bg-green-600 text-white text-xs">
                      {dayApprovals.length}
                    </Badge>
                  )}
                </div>
                
                {hoveredDay && isSameDay(hoveredDay, day) && dayApprovals.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {dayApprovals.slice(0, 3).map((approval, idx) => (
                      <div
                        key={idx}
                        onClick={() => onApprovalClick(approval)}
                        className="text-xs p-1 bg-white rounded border border-green-300 hover:bg-green-50 cursor-pointer truncate"
                      >
                        {approval.event_name}
                      </div>
                    ))}
                    {dayApprovals.length > 3 && (
                      <div className="text-xs text-slate-500 text-center">
                        +{dayApprovals.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Full Month View */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-orange-600" />
            <h3 className="text-xl font-bold text-slate-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
            >
              <ChevronLeft className="w-4 h-4" />
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
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
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
                className={`min-h-[100px] p-2 rounded-lg border-2 transition-all ${
                  isToday
                    ? 'border-orange-500 bg-orange-50'
                    : dayApprovals.length > 0 && isCurrentMonth
                    ? 'border-green-200 bg-green-50 hover:border-green-400 cursor-pointer'
                    : isCurrentMonth
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className={`text-sm font-semibold mb-1 ${
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
                    {dayApprovals.slice(0, 2).map((approval, idx) => (
                      <div
                        key={idx}
                        onClick={() => onApprovalClick(approval)}
                        className="text-xs p-1 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer truncate"
                        title={approval.event_name}
                      >
                        {approval.event_name}
                      </div>
                    ))}
                    {dayApprovals.length > 2 && (
                      <div className="text-xs text-slate-500 text-center">
                        +{dayApprovals.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}