# Event Hub Module

## Title

Event Hub Module

## Purpose / Overview

The Event Hub centralizes operational event management across all departments. It provides a unified interface for viewing, managing, and updating event operations tasks, room setups, maintenance, and cleaning schedules across multiple bookable rooms. This module moves the existing "Event Ops" functionality out of the My Department page to a standalone area, making it accessible to operations staff and, in read‑only form, to normal users.

## Scope

Included:
- A new top‑level page (`/event-hub`) listing upcoming events requiring room setup, maintenance, or cleaning.
- Replication of existing Event Ops features (queue of events, room setup checklist, progress tracking) for all departments.
- A per‑room timeline showing setup, clean, and reset due times and time until the next event.
- Integration of cleaning schedules with special emphasis on Wednesday evening and Sunday morning turnarounds; rooms that have hosted events since the last scheduled cleaning will appear as needing cleaning.
- A 14‑day room usage heat map similar to the current Room Heat Map.
- Ability to view and update per‑room statuses (Not Started / In Progress / Done / Blocked) for setup, cleaning, and reset, including staff assignments and notes.
- Display of Planning Center Online (PCO) approval answers (room setups and maintenance questions) for each event and room.
- An optional map overlay using uploaded floor plans to visualize room statuses (to be implemented once map coordinates are available).
- Role‑based access: operations staff can view and update tasks; normal users can view events and room statuses but cannot edit.

Out of scope:
- Major redesign of the existing Event Ops components.
- Deep integration with external analytics beyond the existing heat map.
- Detailed map overlays until coordinates and assets are provided.

## Data Model / Entities

Existing entities reused:
- **EventOps** – existing record representing an event requiring operations tasks (room setups, maintenance).
- **RoomOps** – existing record representing per‑room tasks for setup, cleaning, and reset with due times, statuses, alerts, assigned staff, and notes.
- **RoomOccupancyDaily** – existing entity storing minutes booked, booking count, and conflict counts per room/day.
- **PCO_Event** and **PCO_BookableRoom** – used to enrich events and rooms.

New/Updated fields:
- **RoomOps.clean_due_at** – ensure this field is populated when cleaning is required (e.g., Wednesday evening and Sunday morning schedules).
- **RoomOps.status_cleaning** – track cleaning status separately from setup and reset.
- **RoomOps.room_available_at** – time when the room is free for next event (already exists but must be consistently set).
- **RoomMapCoordinate** (new entity or fields) – optionally map a room’s PCO resource ID to X/Y coordinates on uploaded floor plans for future map overlays.
- **User.roles** – define a new `EventHubViewer` role for read‑only access.

## API Changes / Functions

Existing functions reused:
- `getPCOCalendarEvents` – fetch PCO events; used by `loadPcoFacilitiesEvents` in My Department【184157645073802†L382-L407】.
- `computeRoomHeatmap` – serverless function computing room occupancy metrics【865348612508961†L200-L237】.

New or modified functions:
1. **getEventOpsHub** (serverless)  
   - **Purpose:** Return all `EventOps` records filtered by date range, along with enriched event details and approval answers.  
   - **Input:** date_range (start, end), optional room_pco_resource_id, optional show_filters (room_setup, maintenance, alerts).  
   - **Output:** List of events with counts for rooms total and complete, boolean flags for `needs_room_setup`, `needs_maintenance`, and PCO approval answers.  
   - **Auth:** requires valid Base44 token with PCO scopes.

2. **getRoomOpsForEvent** (serverless)  
   - **Purpose:** Given a PCO event ID, return the associated `RoomOps` records, sorted by alert status and due times.  
   - **Input:** pco_event_id.  
   - **Output:** List of `RoomOps` with room name, status_setup, status_cleaning, status_reset, assigned_to_name/email, notes, and due times.  
   - **Auth:** requires Base44 token.

3. **updateRoomOpsStatus** (serverless)  
   - **Purpose:** Update statuses (setup, cleaning, reset), assigned staff, or notes for a given `RoomOps` record.  
   - **Input:** room_ops_id, updates object.  
   - **Output:** Updated record.

4. **getRoomTimeline** (serverless)  
   - **Purpose:** For a given bookable room, return upcoming events with their start/end times and due times for setup, cleaning, and reset to generate a timeline. Include time until next event after the current time.  
   - **Input:** room_pco_resource_id, optional days = 7.  
   - **Output:** Sorted list of timeline entries.

5. **getCleaningSchedule** (serverless)  
   - **Purpose:** Determine if a room needs cleaning based on the last cleaned timestamp, the next scheduled cleaning (Wed PM, Sun AM), and whether it hosted events since last cleaning.  
   - **Input:** room_pco_resource_id.  
   - **Output:** Boolean flag `needs_cleaning` and next cleaning due time.

6. **RoomMapCoordinates CRUD** (optional)  
   - **Purpose:** Manage mapping from room IDs to map coordinates if map overlays are enabled.

## UI Changes

- **Event Hub page** accessible from the main navigation.
- **Event List Panel** replicating `EventOpsQueue`: shows upcoming events with date filters and category filters (all, room setup, maintenance, alerts). Each card displays event name, time, progress bar (rooms complete / total), and badges for setup/maintenance alerts【621696517459477†L22-L67】.
- **Detail Drawer** replicating `EventOpsDetailDrawer`: slides out on event click; shows event info, approval answers for setup/maintenance, and a list of rooms with statuses, due times (`room_available_at`, `setup_due_at`, `clean_due_at`)【402590278721692†L195-L204】. Allows operations staff to update statuses, assign staff, and add notes.
- **Room Timeline view**: a new component accessible via a “Room Timeline” tab or button that displays, for a selected room, a chronological view of upcoming events with colored bars representing setup, event time, clean, and reset windows. Shows “Next event in X hrs” at the top.
- **Cleaning Schedule indicators**: highlight rooms that need cleaning (e.g., red dot on event cards or a list in the detail drawer). Provide a quick action to mark cleaning as done.
- **Room Heat Map**: replicate `RoomHeatMap` to give a 14‑day occupancy overview with intensity colors【253543912049748†L29-L46】【253543912049748†L95-L169】.
- **Map Overlay (future)**: placeholder or collapsed panel for map view; will display the uploaded floor plans with overlayed room statuses once coordinates are provided.

## User Flow

1. **Navigate to Event Hub:** User selects “Event Hub” from the sidebar.
2. **Event list loads:** The queue of upcoming events appears, filtered by the next 14 days by default. The user can adjust date range or filter by category.
3. **View event details:** Clicking an event opens the detail drawer with event info, approval answers, and room tasks.
4. **Manage room tasks:** Operations staff can update statuses, assign staff, set notes, or mark tasks as done. Normal users see read‑only statuses.
5. **View room timeline:** Selecting a room (either from the heat map or a “Room Timeline” tab) opens the timeline view showing upcoming events and cleaning schedules with time until next event.
6. **Heat map overview:** Users can switch to the heat map to see usage intensity across all rooms and click a cell to drill into a specific date/room.
7. **Map overlay (future):** When implemented, users can open the map overlay to visually locate rooms and view statuses.

## Acceptance Criteria

- [ ] A new `/event-hub` route exists and is accessible to authorized users.
- [ ] Event list displays upcoming events across departments, with filters for date range, room, and category (all, room setup, maintenance, alerts).
- [ ] Event detail drawer shows event information, PCO approval answers, and a list of associated rooms with statuses, due times, assigned staff, and notes; operations staff can update these fields.
- [ ] A per‑room timeline view is available showing upcoming events and cleaning schedules with time until next event.
- [ ] A cleaning schedule mechanism flags rooms that require cleaning (e.g., after Wednesday evening or Sunday morning events) and ensures they appear in the operations queue.
- [ ] A 14‑day room heat map displays usage intensity and allows drilling down to specific dates/rooms.
- [ ] Permissions are enforced: users with `EventHubViewer` role can view events and room statuses but cannot update them.
- [ ] All new functions are documented and tested, and environment variables or PCO scopes are configured appropriately.
- [ ] Updates to the data model are backward‑compatible with existing Event Ops functionality.

## Dependencies & Considerations

- Requires valid Planning Center Online (PCO) API credentials and Graph scopes stored on the user’s Base44 profile.
- Existing entities `EventOps`, `RoomOps`, and `RoomOccupancyDaily` must be populated correctly; `computeRoomHeatmap` should be scheduled regularly to update occupancy metrics.
- New functions will require environment variables or secrets for PCO and Base44 tokens.
- Map overlay depends on receiving floor plan images and mapping coordinates; this can be deferred until data is available.
- Additional load on the system from fetching events across all departments and computing timelines should be monitored; consider pagination or caching.

## Timeline / Estimation

Initial implementation (excluding map overlay) is estimated at 2–3 sprints.  Map overlay work will be scoped separately once assets and coordinates are available.
