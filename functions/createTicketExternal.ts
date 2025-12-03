import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { requesterEmail, category, description, location, subject } = await req.json();

        // Find requester
        const users = await base44.asServiceRole.entities.User.filter({ email: requesterEmail });
        const requester = users[0];

        // Generate ticket number
        const allTickets = await base44.asServiceRole.entities.Ticket.list('-created_date', 1);
        let nextNumber = 1;
        if (allTickets.length > 0 && allTickets[0].ticket_number) {
            const lastNum = parseInt(allTickets[0].ticket_number.replace('TKT-', ''));
            nextNumber = lastNum + 1;
        }
        const ticketNumber = `TKT-${String(nextNumber).padStart(6, '0')}`;

        // Create ticket
        const ticket = await base44.asServiceRole.entities.Ticket.create({
            ticket_number: ticketNumber,
            requester_email: requesterEmail,
            requester_name: requester?.full_name || requesterEmail,
            category,
            subject: subject || description?.substring(0, 100) || 'New Ticket',
            description,
            building: location,
            status: "open",
            priority: "medium",
            source: "workflow"
        });

        return Response.json({ success: true, ticket });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});