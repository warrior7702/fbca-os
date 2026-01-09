import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Loader2 } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";

export default function RoomHeatMap({ onCellClick }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState([]);

  useEffect(() => {
    loadHeatmapData();
  }, []);

  const loadHeatmapData = async () => {
    setLoading(true);
    try {
      // Generate 14 days
      const now = new Date();
      const dateList = [];
      for (let i = 0; i < 14; i++) {
        dateList.push(format(addDays(startOfDay(now), i), 'yyyy-MM-dd'));
      }
      setDates(dateList);

      // Fetch all room occupancy data
      const allData = await base44.entities.RoomOccupancyDaily.list();
      
      // Group by room
      const roomMap = new Map();
      allData.forEach(record => {
        if (!roomMap.has(record.room_pco_resource_id)) {
          roomMap.set(record.room_pco_resource_id, {
            room_id: record.room_pco_resource_id,
            room_name: record.room_name,
            dates: {}
          });
        }
        roomMap.get(record.room_pco_resource_id).dates[record.date] = record;
      });

      setHeatmapData(Array.from(roomMap.values()));
    } catch (error) {
      console.error('Error loading heatmap data:', error);
      toast.error('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  };

  const getIntensityColor = (minutes) => {
    if (!minutes || minutes === 0) return 'bg-slate-50';
    if (minutes < 120) return 'bg-green-100';
    if (minutes < 240) return 'bg-yellow-100';
    if (minutes < 360) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getIntensityText = (minutes) => {
    if (!minutes || minutes === 0) return '0';
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading heat map...</p>
        </CardContent>
      </Card>
    );
  }

  if (heatmapData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            Room Heat Map
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <p className="text-slate-600">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            Room Heat Map (Next 14 Days)
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">Usage:</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" title="< 2hrs" />
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" title="2-4hrs" />
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded" title="4-6hrs" />
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" title="6+hrs" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-slate-700 p-2 border-b sticky left-0 bg-white z-10">
                  Room
                </th>
                {dates.map(date => (
                  <th key={date} className="text-center text-xs font-medium text-slate-600 p-2 border-b min-w-[60px]">
                    {format(new Date(date), 'MMM d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map(room => (
                <tr key={room.room_id} className="hover:bg-slate-50">
                  <td className="text-xs font-medium text-slate-900 p-2 border-b sticky left-0 bg-white">
                    {room.room_name}
                  </td>
                  {dates.map(date => {
                    const dayData = room.dates[date];
                    const minutes = dayData?.minutes_booked || 0;
                    const conflicts = dayData?.peak_conflicts || 0;
                    
                    return (
                      <td
                        key={date}
                        onClick={() => {
                          if (dayData && onCellClick) {
                            onCellClick(room.room_id, date);
                          }
                        }}
                        className={`text-center p-2 border-b cursor-pointer transition-all hover:ring-2 hover:ring-violet-400 ${getIntensityColor(minutes)}`}
                        title={`${room.room_name} - ${format(new Date(date), 'MMM d')}\n${getIntensityText(minutes)} booked\n${dayData?.booking_count || 0} bookings\n${conflicts} conflicts`}
                      >
                        <div className="text-xs font-semibold text-slate-700">
                          {getIntensityText(minutes)}
                        </div>
                        {conflicts > 0 && (
                          <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 mt-1">
                            {conflicts}
                          </Badge>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}