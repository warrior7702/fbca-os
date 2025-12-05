import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// This endpoint allows the Teams bot to add comments to existing tickets
// Called when a user replies in Teams to an existing ticket conversation

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const body = await req.json();
        
        const {
            ticket_id,
            ticket_number,
            author_email,
            author_name,
            content,
            attachments = []
        } = body;

        if (!content) {
            return Response.json({ error: 'content is required' }, { status: 400 });
        }

        // Find ticket by ID or ticket number
        let ticket = null;
        if (ticket_id) {
            const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id });
            ticket = tickets[0];
        } else if (ticket_number) {
            const tickets = await base44.asServiceRole.entities.Ticket.filter({ ticket_number });
            ticket = tickets[0];
        }

        if (!ticket) {
            return Response.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Process attachments if any (same logic as createTicketExternal)
        const processedAttachments = [];
        for (const attachment of attachments) {
            try {
                if (attachment.base64) {
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
                    processedAttachments.push({
                        name: attachment.name || 'attachment',
                        url: attachment.url,
                        uploaded_at: new Date().toISOString()
                    });
                }
            } catch (attachErr) {
                console.error('Failed to process attachment:', attachment.name, attachErr);
            }
        }

        // Build the new comment
        const newComment = {
            author_email: author_email || ticket.requester_email,
            author_name: author_name || ticket.requester_name || 'Teams User',
            content: content,
            is_internal: false,
            timestamp: new Date().toISOString()
        };

        // If there are attachments, mention them in the comment
        if (processedAttachments.length > 0) {
            newComment.content += `\n\n📎 ${processedAttachments.length} attachment(s) added`;
        }

        // Update ticket with new comment and attachments
        const existingComments = ticket.comments || [];
        const existingAttachments = ticket.attachments || [];

        await base44.asServiceRole.entities.Ticket.update(ticket.id, {
            comments: [...existingComments, newComment],
            attachments: [...existingAttachments, ...processedAttachments],
            last_activity_at: new Date().toISOString(),
            // If ticket was resolved/archived, reopen it when user replies
            status: ['resolved', 'archived'].includes(ticket.status) ? 'open' : ticket.status
        });

        return Response.json({ 
            success: true, 
            ticket_number: ticket.ticket_number,
            comment_added: true,
            attachments_added: processedAttachments.length
        });

    } catch (error) {
        console.error('Error adding comment:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});