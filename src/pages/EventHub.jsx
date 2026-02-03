import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EventOpsQueue from "@/components/eventops/EventOpsQueue";
import RoomHeatMap from "@/components/eventops/RoomHeatMap";
import RoomTimelineTab from "@/components/eventops/RoomTimelineTab";
import EventOpsDetailDrawer from "@/components/eventops/EventOpsDetailDrawer";

/**
 * Event Hub module page.
 *
 * The Event Hub aggregates event operations across all departments.
 * This page provides a unified view into upcoming events, room heat maps,
 * and per room setup timelines. Users can filter the queue by room and date
 * by interacting with the heat map, and view detailed room operations by
 * selecting an event from the queue.
 */
export default function EventHub() {
  // Currently active tab. Use "queue" by default.
  const [activeTab, setActiveTab] = useState("queue");
  // Selected event for the detail drawer.
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Whether the detail drawer is open.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Optional filters passed to the queue: room id and date string (yyyy-MM-dd).
  const [roomFilter, setRoomFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState(null);
  // Simple key to force re mounting of the queue when rooms are updated.
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Handle selection of an event from the operations queue.
   * Opens the detail drawer and stores the selected event.
   */
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  /**
   * Handle cell click on the room heat map.
   * When a user clicks a cell, use that room/date to filter the queue and
   * switch back to the queue tab.
   */
  const handleCellClick = (roomId, date) => {
    setRoomFilter(roomId);
    setDateFilter(date);
    setActiveTab("queue");
    // Clear any previously selected event.
    setSelectedEvent(null);
  };

  /**
   * Close the detail drawer.
   */
  const handleDrawerClose = () => {
    setDrawerOpen(false);
    // Optionally clear the event when closing.
    // setSelectedEvent(null);
  };

  /**
   * Handle updates from the detail drawer.
   * When a room is updated (e.g. status changes), refresh the queue by bumping the key.
   */
  const handleDrawerUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Event Hub</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="queue">Ops Queue</TabsTrigger>
          <TabsTrigger value="heatmap">Room Heat Map</TabsTrigger>
          <TabsTrigger value="timeline">Room Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <EventOpsQueue
            key={refreshKey}
            onEventClick={handleEventClick}
            roomFilter={roomFilter}
            dateFilter={dateFilter}
          />
        </TabsContent>
        <TabsContent value="heatmap">
          <RoomHeatMap onCellClick={handleCellClick} />
        </TabsContent>
        <TabsContent value="timeline">
          <RoomTimelineTab />
        </TabsContent>
      </Tabs>
      <EventOpsDetailDrawer
        event={selectedEvent}
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        onUpdate={handleDrawerUpdate}
      />
    </div>
  );
}
