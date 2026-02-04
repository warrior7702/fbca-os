import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Flame, ThermometerSun, CheckCircle, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CleaningAcknowledgeModal from "@/components/eventops/CleaningAcknowledgeModal";

export default function CleaningWarningBanner({ room, warning, onRefresh }) {
  const [showAckModal, setShowAckModal] = useState(false);
  const [markingClean, setMarkingClean] = useState(false);

  if (!warning) return null;

  // Ensure warning has required structure
  const warningData = {
    text: warning.text || warning.warning_text || 'Room needs cleaning',
    temperature: warning.temperature || 'WARM',
    event_time: warning.event_time,
    event_name: warning.event_name
  };

  // Calculate countdown
  const getCountdown = (eventTime) => {
    if (!eventTime) return null;
    const now = new Date();
    const eventDate = new Date(eventTime);
    const ms = eventDate - now;
    if (ms < 0) return 'Soon';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'Soon';
  };

  const handleMarkClean = async () => {
    if (!confirm(`Mark ${room.room_name || room.room_number} as clean?\n\nThis will update last_cleaned_at and clear the warning immediately.`)) {
      return;
    }

    setMarkingClean(true);
    try {
      const user = await base44.auth.me();

      await base44.functions.invoke('markRoomAsClean', {
        room_id: room.id,
        marked_by_user_id: user.email,
        marked_by_user_name: user.full_name
      });

      toast.success('✓ Room marked as clean!');

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Mark clean error:', error);
      toast.error('Failed to mark room as clean');
    } finally {
      setMarkingClean(false);
    }
  };

  const getTemperatureColor = (temp) => {
    switch(temp) {
      case 'HOT': return 'bg-red-50 border-red-200';
      case 'WARM': return 'bg-orange-50 border-orange-200';
      case 'COOL': return 'bg-green-50 border-green-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getTemperatureIcon = (temp) => {
    switch(temp) {
      case 'HOT': return <Flame className="w-5 h-5 text-red-500" />;
      case 'WARM': return <ThermometerSun className="w-5 h-5 text-orange-500" />;
      case 'COOL': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return null;
    }
  };

  const getTemperatureText = (temp) => {
    switch(temp) {
      case 'HOT': return 'URGENT';
      case 'WARM': return 'SOON';
      case 'COOL': return 'ON SCHEDULE';
      default: return '';
    }
  };

  return (
    <>
      <div className={`rounded-lg border-2 p-3 sm:p-4 mb-4 ${getTemperatureColor(warningData.temperature)}`}>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getTemperatureIcon(warningData.temperature)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm sm:text-base text-slate-900">
                  {room?.room_name || 'Room'} {room?.room_number && `(${room.room_number})`}
                </h4>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  warningData.temperature === 'HOT' ? 'bg-red-100 text-red-800' :
                  warningData.temperature === 'WARM' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {getTemperatureText(warningData.temperature)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700">{warningData.text}</p>
              {warningData.event_time && (
                <p className="text-xs text-slate-500 mt-1">
                  Next event: {new Date(warningData.event_time).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit',
                    meridiem: 'short'
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200/50">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAckModal(true)}
              className="flex-1 sm:flex-none text-xs sm:text-sm"
            >
              <Calendar className="w-3 h-3 mr-1" />
              Set Plan
            </Button>
            <Button
              size="sm"
              onClick={handleMarkClean}
              disabled={markingClean}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
            >
              {markingClean ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3 mr-1" />
              )}
              Mark Clean
            </Button>
          </div>
        </div>
      </div>

      <CleaningAcknowledgeModal
        open={showAckModal}
        onOpenChange={setShowAckModal}
        room={room}
        warning={warningData}
        onAcknowledged={onRefresh}
      />
    </>
  );
}