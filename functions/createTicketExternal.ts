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
        
        // Attachments support - accepts array of objects with name and url
        // Format: [{ name: "file.png", url: "https://..." }]
        // Also supports base64: [{ name: "file.png", base64: "data:image/png;base64,..." }]
        const rawAttachments = body.attachments || [];

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

        // Process attachments - upload base64 files to Base44 storage
        const processedAttachments = [];
        for (const attachment of rawAttachments) {
            try {
                if (attachment.base64) {
                    // Convert base64 to blob and upload
                    const base64Data = attachment.base64.includes(',') 
                        ? attachment.base64.split(',')[1] 
                        : attachment.base64;
                    
                    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    const blob = new Blob([binaryData]);
                    const file = new File([blob], attachment.name || 'attachment', {
                        type: attachment.contentType || 'application/octet-stream'
                    });
                    
                    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                    processedAttachments.push({
                        name: attachment.name || 'attachment',
                        url: uploadResult.file_url,
                        uploaded_at: new Date().toISOString()
                    });
                } else if (attachment.url) {
                    // URL-based attachment - store directly
                    processedAttachments.push({
                        name: attachment.name || 'attachment',
                        url: attachment.url,
                        uploaded_at: new Date().toISOString()
                    });
                }
            } catch (attachErr) {
                console.error('Failed to process attachment:', attachment.name, attachErr);
                // Continue with other attachments
            }
        }

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
            source: source,
            attachments: processedAttachments.length > 0 ? processedAttachments : []
        });

        return Response.json({ 
            success: true, 
            ticket,
            attachments_processed: processedAttachments.length 
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});