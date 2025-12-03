import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const body = await req.json();
        
        // Support both formats: camelCase (bot) and snake_case (legacy)
        const requesterEmail = body.requester_email || body.requesterEmail;
        const requesterName = body.requester_name || body.requesterName;
        const category = body.category;
        const description = body.description;
        const location = body.location || body.building || body.room_number;
        const subject = body.subject;
        const priority = body.priority || 'medium';
        const source = body.source || 'bot';

        // Find requester if email provided
        let requester = null;
        if (requesterEmail) {
            const users = await base44.asServiceRole.entities.User.filter({ email: requesterEmail });
            requester = users[0];
        }

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
            requester_email: requesterEmail || 'unknown@fbca.dev',
            requester_name: requester?.full_name || requesterName || requesterEmail || 'Bot User',
            category: category?.toLowerCase(),
            subject: subject || description?.substring(0, 100) || 'New Ticket',
            description,
            building: location,
            room_number: body.room_number,
            status: 'open',
            priority: priority,
            source: source
        });

        return Response.json({ success: true, ticket });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});