import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const body = await req.json();
        
        // Support multiple field name formats
        const requesterEmail = body.requester_email || body.requesterEmail || body.from_email;
        const requesterName = body.requester_name || body.requesterName || body.from_name;
        const category = body.category;
        const description = body.description;
        const building = body.building;
        const roomNumber = body.room_number || body.room;
        const subject = body.subject;
        const priority = body.priority || 'medium';
        const source = body.source || 'bot';
        
        // Attachments support - accepts array of objects with name and url
        // Format: [{ name: "file.png", url: "https://..." }]
        // Also supports base64: [{ name: "file.png", base64: "data:image/png;base64,..." }]
        const rawAttachments = body.attachments || [];
        
        // Teams conversation data for 2-way messaging
        const teamsConversationId = body.teams_conversation_id || body.teamsConversationId;
        const teamsServiceUrl = body.teams_service_url || body.teamsServiceUrl;

        // Find requester if email provided and get proper name
        let requester = null;
        let formattedName = requesterName;
        
        if (requesterEmail) {
            const users = await base44.asServiceRole.entities.User.filter({ email: requesterEmail });
            requester = users[0];
            
            // Use full_name from User entity if available
            if (requester?.full_name) {
                formattedName = requester.full_name;
            } else if (requesterName) {
                // Format the name: capitalize each word, replace dots/underscores with spaces
                formattedName = requesterName
                    .replace(/[._]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            } else {
                // Extract name from email if no name provided
                const emailName = requesterEmail.split('@')[0];
                formattedName = emailName
                    .replace(/[._]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            }
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
            requester_name: formattedName || requesterEmail || 'Bot User',
            category: category?.toLowerCase(),
            subject: subject || (description?.substring?.(0, 100)) || 'New Ticket',
            description: description || `Ticket created via Spark bot at ${new Date().toLocaleString()}`,
            building: building || null,
            room_number: roomNumber || null,
            status: 'open',
            priority: priority,
            source: source,
            attachments: processedAttachments.length > 0 ? processedAttachments : [],
            teams_conversation_id: teamsConversationId || null,
            teams_service_url: teamsServiceUrl || null
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