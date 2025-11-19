import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Incoming JSON payload from Zapier
    const {
      subject,
      body,
      sender,
      department,
      classification
    } = await req.json();

    // Basic validation
    if (!subject || !body || !sender) {
      return Response.json({
        error: "Missing required fields: subject, body, sender"
      }, { status: 400 });
    }

    // Normalize department input
    const deptNormalized = (department || "").toLowerCase();

    const categoryMap = {
      "technology": "technology",
      "tech": "technology",
      "cleaning": "cleaning",
      "maintenance": "maintenance",
      "maint": "maintenance",
      "facilities": "maintenance"
    };

    const ticketCategory = categoryMap[deptNormalized] || "maintenance";

    // Generate sequential ticket number
    const allTickets = await base44.asServiceRole.entities.Ticket.list();
    const ticketNumber = `TKT-${String(allTickets.length + 1).padStart(6, "0")}`;

    // Confidence tag (safe)
    const confidenceTag = classification?.confidence
      ? [`ai_confidence_${Math.round((classification.confidence || 0) * 100)}`]
      : [];

    // Create ticket
    const ticket = await base44.asServiceRole.entities.Ticket.create({
      ticket_number: ticketNumber,
      subject: subject,
      description: body,
      category: ticketCategory,
      source: "email",
      status: "open",
      priority: "medium",
      requester_email: sender,
      requester_name: sender,
      created_date: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      tags: confidenceTag
    });

    // Try auto-assign (optional)
    try {
      await base44.asServiceRole.functions.invoke("autoAssignTicket", {
        ticket_id: ticket.id
      });
    } catch (assignError) {
      console.log("Auto-assign skipped:", assignError.message);
    }

    // Success response
    return Response.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        category: ticket.category,
        status: ticket.status
      }
    });

  } catch (error) {
    console.error("Ticket creation error:", error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});
