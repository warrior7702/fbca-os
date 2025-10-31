import React, { useState, useEffect } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function ApprovalCalendar({ approvals, onApprovalClick }) {
  const [startDate, setStartDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedApprovals, setExpandedApprovals] = useState({});
  const [approvalDetails, setApprovalDetails] = useState({});

  const days = Array.from({ length: 14 }, (_, i) => addDays(startDate, i));

  const getApprovalsForDate = (date) => {
    return approvals.filter(approval => {
      const eventDate = new Date(approval.event_starts_at);
      return isSameDay(eventDate, date);
    });
  };

  const handlePrevWeek = () => {
    setStartDate(addDays(startDate, -7));
    setSelectedDate(null);
  };

  const handleNextWeek = () => {
    setStartDate(addDays(startDate, 7));
    setSelectedDate(null);
  };

  const handleDateClick = (date) => {
    const dayApprovals = getApprovalsForDate(date);
    if (dayApprovals.length > 0) {
      setSelectedDate(isSameDay(date, selectedDate) ? null : date);
    }
  };

  const toggleExpanded = async (requestId) => {
    setExpandedApprovals(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));

    // Load details if not already loaded
    if (!approvalDetails[requestId]) {
      await loadApprovalDetails(requestId);
    }
  };

  const loadApprovalDetails = async (requestId) => {
    const approval = approvals.find(a => a.request_id === requestId);
    if (!approval) return;

    try {
      const response = await base44.functions.invoke('getApprovalDetails', {
        request_id: approval.request_id,
        event_id: approval.event_id,
        resource_id: approval.resource_id
      });

      if (response.data.ok) {
        setApprovalDetails(prev => ({
          ...prev,
          [requestId]: {
            questions: response.data.questions || [],
            answers: response.data.answers || {}
          }
        }));
      }
    } catch (error) {
      console.error('Error loading approval details:', error);
    }
  };

  const selectedDateApprovals = selectedDate ? getApprovalsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          {format(startDate, 'MMM d')} - {format(addDays(startDate, 13), 'MMM d, yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {days.map((day, index) => {
          const dayApprovals = getApprovalsForDate(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <motion.div
              key={index}
              whileHover={dayApprovals.length > 0 ? { scale: 1.02 } : {}}
              whileTap={dayApprovals.length > 0 ? { scale: 0.98 } : {}}
            >
              <Card
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'border-2 border-orange-500 shadow-lg'
                    : dayApprovals.length > 0
                    ? 'border-2 border-orange-200 hover:border-orange-400'
                    : 'border border-slate-200'
                } ${isToday ? 'bg-blue-50' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 font-medium">
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </p>
                    {dayApprovals.length > 0 && (
                      <Badge className="mt-1 bg-orange-500 text-white text-xs">
                        {dayApprovals.length}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Date Details */}
      <AnimatePresence>
        {selectedDate && selectedDateApprovals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              <CalendarIcon className="w-5 h-5 inline mr-2" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>

            {selectedDateApprovals.map((approval) => {
              const isExpanded = expandedApprovals[approval.request_id];
              const details = approvalDetails[approval.request_id];
              const hasAnswers = details && Object.keys(details.answers).length > 0;

              return (
                <Card key={approval.request_id} className="border-2 border-orange-200">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Event Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-900 mb-2">
                            {approval.event_name}
                          </h4>
                          <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                            <Package className="w-3 h-3 mr-1" />
                            {approval.resource_name}
                          </Badge>
                        </div>
                      </div>

                      {/* Event Details Grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 mb-1">Event Time:</p>
                          <p className="font-medium text-slate-900">
                            {format(new Date(approval.event_starts_at), 'h:mm a')}
                            {approval.event_ends_at && ` - ${format(new Date(approval.event_ends_at), 'h:mm a')}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Approval Group:</p>
                          <p className="font-medium text-slate-900">{approval.approval_group_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Quantity:</p>
                          <p className="font-medium text-slate-900">{approval.quantity || 1}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Requested:</p>
                          <p className="font-medium text-slate-900">
                            {approval.pco_created_at
                              ? format(new Date(approval.pco_created_at), 'MMM d, yyyy')
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Additional Info Toggle */}
                      {!isExpanded && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(approval.request_id)}
                          className="text-orange-600 hover:text-orange-700 p-0 h-auto"
                        >
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Show Additional Info
                        </Button>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(approval.request_id)}
                            className="text-orange-600 hover:text-orange-700 p-0 h-auto"
                          >
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Additional Info
                          </Button>

                          {hasAnswers ? (
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                              {details.questions.map((question) => {
                                const answer = details.answers[question.id];
                                if (!answer) return null;

                                return (
                                  <div key={question.id}>
                                    <p className="text-sm font-medium text-slate-700 mb-1">
                                      {question.question}
                                    </p>
                                    <p className="text-sm text-slate-900">{answer}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No additional information available</p>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}