import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.19.3/package/xlsx.mjs";

// Auto-detect whether file is CSV/TXT or XLSX
function parseFile(buffer, filename) {
  const text = new TextDecoder().decode(buffer);

  // XLSX files always begin with PK
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  // Tab-delimited text (Rooms + Assets)
  if (text.includes("\t")) {
    const lines = text.split(/\r?\n/);
    const headers = lines[0].split("\t");

    return lines.slice(1).map((line) => {
      const cols = line.split("\t");
      let row = {};
      headers.forEach((h, i) => (row[h.trim()] = cols[i]?.trim() || ""));
      return row;
    });
  }

  throw new Error("Unsupported file type: " + filename);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { floorsFileId, roomsFileId, assetsFileId } = body;

    if (!floorsFileId || !roomsFileId || !assetsFileId) {
      return Response.json({ error: "Missing file IDs" }, { status: 400 });
    }

    // Download the files
    const floorsFile = await base44.storage.getFile(floorsFileId);
    const roomsFile = await base44.storage.getFile(roomsFileId);
    const assetsFile = await base44.storage.getFile(assetsFileId);

    const floorsArr = parseFile(floorsFile, "floors");
    const roomsArr = parseFile(roomsFile, "rooms");
    const assetsArr = parseFile(assetsFile, "assets");

    console.log("Parsed:", floorsArr.length, "floors,", roomsArr.length, "rooms,", assetsArr.length, "assets");

    // Summary counts
    let stats = {
      floorsCreated: 0,
      floorsUpdated: 0,
      roomsCreated: 0,
      roomsUpdated: 0,
      assetsCreated: 0,
      assetsUpdated: 0,
      errors: [],
    };

    // Process Floors
    for (const f of floorsArr) {
      if (!f._id || !f.Name) {
        stats.errors.push("Floor missing ID or Name: " + JSON.stringify(f));
        continue;
      }

      let existing = await base44.entities.Floor.first({
        where: { akita_floor_id: f._id },
      });

      if (existing) {
        await base44.entities.Floor.update(existing.id, {
          name: f.Name,
          floor_plan_file: f["Floor Plan"] || "",
        });
        stats.floorsUpdated++;
      } else {
        await base44.entities.Floor.create({
          name: f.Name,
          akita_floor_id: f._id,
          level_number: f.Name,
          floor_plan_file: f["Floor Plan"] || "",
        });
        stats.floorsCreated++;
      }
    }

    // Rooms (similar logic)
    for (const r of roomsArr) {
      if (!r._id || !r.Name) continue;

      let floor = await base44.entities.Floor.first({
        where: { akita_floor_id: r["Floor _id"] },
      });

      let existing = await base44.entities.Room.first({
        where: { akita_room_id: r._id },
      });

      let data = {
        name: r.Name,
        akita_room_id: r._id,
        number: r.Number || "",
        occupant: r.Occupant || "",
        floor: floor?.id || null,
      };

      if (existing) {
        await base44.entities.Room.update(existing.id, data);
        stats.roomsUpdated++;
      } else {
        await base44.entities.Room.create(data);
        stats.roomsCreated++;
      }
    }

    // Assets (similar logic)
    for (const a of assetsArr) {
      if (!a._id || !a.Name) continue;

      let floor = await base44.entities.Floor.first({
        where: { akita_floor_id: a["Floor _id"] },
      });

      let room = await base44.entities.Room.first({
        where: { akita_room_id: a["Room Number _id"] },
      });

      const coords = {
        x_coord: parseFloat(a["X Coordinate"] || 0),
        y_coord: parseFloat(a["Y Coordinate"] || 0),
      };

      let existing = await base44.entities.Asset.first({
        where: { akita_asset_id: a._id },
      });

      let payload = {
        name: a.Name,
        akita_asset_id: a._id,
        manufacturer: a.Manufacturer || "",
        model: a.Model || "",
        serial: a["Serial Number"] || "",
        ...coords,
        floor: floor?.id || null,
        room: room?.id || null,
      };

      if (existing) {
        await base44.entities.Asset.update(existing.id, payload);
        stats.assetsUpdated++;
      } else {
        await base44.entities.Asset.create(payload);
        stats.assetsCreated++;
      }
    }

    console.log("Summary:", stats);

    return Response.json(stats);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
