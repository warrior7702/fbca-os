/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FBCA SYSTEM ARCHITECTURE RULES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This document defines the authoritative sources of truth for different
 * data domains in the FBCA system. READ THIS before making architectural
 * changes or integrating new features.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * SOURCE OF TRUTH DEFINITIONS
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. PLANNING CENTER ONLINE (PCO) - Authoritative for:
 * ───────────────────────────────────────────────────────────────────────────
 *    ✓ Events and Event Instances
 *    ✓ Bookable Rooms (all rooms available for event scheduling)
 *    ✓ Resource Requests (room setups, maintenance needs, etc.)
 *    ✓ Approval Group memberships and answers
 *    ✓ Event-related resource assignments
 * 
 *    Data Flow: PCO API → PCO_BookableRoom, PCO_Event, PCO_Request, PCO_EventRoom
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 2. FBCA CAMPUS HUB (AkitaBox) - Authoritative for:
 * ───────────────────────────────────────────────────────────────────────────
 *    ✓ Building floor plans and maps
 *    ✓ Room numbers and physical locations
 *    ✓ Asset inventory and documentation
 *    ✓ Non-bookable spaces (storage, mechanical, etc.)
 *    ✓ Maintenance history and asset lifecycle data
 * 
 *    Data Flow: AkitaBox API → Building, Floor, Room, Asset
 *    NOTE: Campus Hub Room.bookable flag is DERIVED from PCO sync (not authoritative)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 3. MY DEPARTMENT - EVENT OPS - Authoritative for:
 * ───────────────────────────────────────────────────────────────────────────
 *    ✓ Operational task planning and assignments
 *    ✓ Task checklists and completion state
 *    ✓ Setup/teardown timelines and windows
 *    ✓ Task priority and blocking status
 * 
 *    Data Flow: 
 *      - Reads from: PCO_EventRoom, PCO_Request
 *      - Writes to: Ops_Task
 *      - MUST pull bookable room list from PCO_BookableRoom (NOT Campus Hub Room)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CRITICAL INTEGRATION RULES
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * RULE 1: Event Ops Room Selection
 * ───────────────────────────────────────────────────────────────────────────
 *    ✅ DO:   Use PCO_BookableRoom entity for all Event Ops room filtering
 *    ❌ DON'T: Use Campus Hub Room entity for Event Ops workflows
 * 
 * RULE 2: Ticket Submission Context
 * ───────────────────────────────────────────────────────────────────────────
 *    ✅ DO:   Pass building/room/asset context when available (from URL params)
 *    ❌ DON'T: Require building/room/asset fields for ticket creation
 *    NOTE: All location fields remain OPTIONAL in ticket forms
 * 
 * RULE 3: Room Bookability Sync
 * ───────────────────────────────────────────────────────────────────────────
 *    - Campus Hub Room.bookable flag is updated during PCO sync
 *    - This flag indicates rooms that exist in both systems
 *    - Event scheduling ONLY uses rooms from PCO_BookableRoom
 * 
 * RULE 4: Data Consistency
 * ───────────────────────────────────────────────────────────────────────────
 *    - PCO sync runs on schedule to keep PCO_BookableRoom current
 *    - Campus Hub sync runs independently for maps/assets
 *    - Event Ops reads from both but writes only to operational entities
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ENTITY MAPPING REFERENCE
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Domain              | Source System | Entity
 * ────────────────────|───────────────|─────────────────────
 * Events              | PCO           | PCO_Event
 * Event Rooms         | PCO           | PCO_EventRoom
 * Bookable Rooms      | PCO           | PCO_BookableRoom
 * Resource Requests   | PCO           | PCO_Request
 * Buildings           | Campus Hub    | Building
 * Floors              | Campus Hub    | Floor
 * Rooms (all)         | Campus Hub    | Room
 * Assets              | Campus Hub    | Asset
 * Event Tasks         | Event Ops     | Ops_Task
 * Support Tickets     | Support       | Ticket
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DEVELOPER QUICK REFERENCE
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Adding Event Ops feature?    → Query PCO_BookableRoom for room selection
 * Adding Campus Hub feature?   → Query Room/Asset for locations/inventory
 * Need event context?          → Query PCO_Event + PCO_EventRoom
 * Building a ticket form?      → All location fields optional; derive from context
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// This file exists solely for documentation purposes
export default null;