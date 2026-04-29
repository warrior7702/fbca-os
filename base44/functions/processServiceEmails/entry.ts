import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Monitored email addresses and their mappings
const SERVICE_EMAILS = {
    'maintenance@fbca.org': {
        category: 'facility',
        team: 'facilities',
        label: 'Maintenance'
    },
    'support@fbca.org': {
        category: 'technical',
        team: 'it',
        label: 'IT Support'
    },
    'cleaning@fbca.org': {
        category: 'facility_cleaning',
        team: 'facilities',
        label: 'Janitorial'
    }
};

// Allowed sender domains and addresses
const ALLOWED_DOMAINS = [
    'fbca.org',
    'planningcenteronline.com',
    'clickup.com',
    'microsoft.com',
    'office365.com'
];

function isAllowedSender(fromEmail) {
    if (!fromEmail) return false;
    
    const email = fromEmail.toLowerCase();
    
    // Check if from allowed domain
    for (const domain of ALLOWED_DOMAINS) {
        if (email.includes(`@${domain}`)) {
            return true;
        }
    }
    
    // Add other known service emails here
    const allowedServices = [
        'noreply@',
        'notifications@',
        'alerts@',
        'service@'
    ];
    
    for (const prefix of allowedServices) {
        if (email.startsWith(prefix)) {
            return true;
        }
    }
    
    return false;
}

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.microsoft_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.microsoft_access_token;
    }

    console.log('Token expired, refreshing...');
    const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
    return refreshResponse.data.access_token;
}

async function getSharedMailboxEmails(accessToken, mailboxEmail) {
    try {
        // Get unread emails from shared mailbox
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${mailboxEmail}/messages?$filter=isRead eq false&$top=50&$orderby=receivedDateTime desc`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch emails from ${mailboxEmail}:`, response.status, errorText);
            return [];
        }

        const data = await response.json();
        return data.value || [];
    } catch (error) {
        console.error(`Error fetching emails from ${mailboxEmail}:`, error);
        return [];
    }
}

async function markEmailAsRead(accessToken, mailboxEmail, messageId) {
    try {
        await fetch(
            `https://graph.microsoft.com/v1.0/users/${mailboxEmail}/messages/${messageId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isRead: true })
            }
        );
    } catch (error) {
        console.error('Error marking email as read:', error);
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // This function should run as service role or with a specific service account
        // For now, we'll use the current user's Microsoft token
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.microsoft_access_token) {
            return Response.json({ error: 'Microsoft 365 not connected' }, { status: 400 });
        }

        console.log('🔍 Starting service email processing...');

        const accessToken = await refreshTokenIfNeeded(base44, user);

        let totalProcessed = 0;
        let ticketsCreated = 0;
        let emailsSkipped = 0;
        const errors = [];

        // Process each monitored mailbox
        for (const [mailboxEmail, config] of Object.entries(SERVICE_EMAILS)) {
            console.log(`\n📧 Checking ${mailboxEmail} (${config.label})...`);

            const emails = await getSharedMailboxEmails(accessToken, mailboxEmail);
            console.log(`   Found ${emails.length} unread emails`);

            for (const email of emails) {
                totalProcessed++;

                // Extract sender email
                const fromEmail = email.from?.emailAddress?.address;
                const fromName = email.from?.emailAddress?.name || fromEmail;
                
                console.log(`   📨 Processing: "${email.subject}" from ${fromEmail}`);

                // Filter spam - only allow @fbca.org and known services
                if (!isAllowedSender(fromEmail)) {
                    console.log(`   ⚠️  Skipped - sender not allowed: ${fromEmail}`);
                    emailsSkipped++;
                    // Mark as read to avoid reprocessing
                    await markEmailAsRead(accessToken, mailboxEmail, email.id);
                    continue;
                }

                // Get email body
                const bodyContent = email.body?.content || email.bodyPreview || '';
                
                // Prepare attachments (if any)
                const attachments = [];
                if (email.hasAttachments && email.attachments) {
                    for (const att of email.attachments) {
                        if (att['@odata.type'] === '#microsoft.graph.fileAttachment') {
                            // For now, just store metadata
                            attachments.push({
                                name: att.name,
                                url: att.contentId || '', // Would need to download and upload to get proper URL
                                uploaded_at: new Date().toISOString()
                            });
                        }
                    }
                }

                // Create ticket
                try {
                    const ticketResponse = await base44.functions.invoke('createTicketFromEmail', {
                        email_id: email.conversationId || email.id,
                        subject: email.subject || 'No Subject',
                        body: bodyContent,
                        from_email: fromEmail,
                        from_name: fromName,
                        attachments: attachments
                    });

                    if (ticketResponse.data.ok) {
                        ticketsCreated++;
                        console.log(`   ✅ Created ticket: ${ticketResponse.data.ticket.ticket_number}`);
                        
                        // Mark email as read
                        await markEmailAsRead(accessToken, mailboxEmail, email.id);
                    } else {
                        console.error(`   ❌ Failed to create ticket:`, ticketResponse.data.error);
                        errors.push({
                            email: email.subject,
                            error: ticketResponse.data.error
                        });
                    }
                } catch (ticketError) {
                    console.error(`   ❌ Error creating ticket:`, ticketError);
                    errors.push({
                        email: email.subject,
                        error: ticketError.message
                    });
                }
            }
        }

        console.log('\n📊 Processing complete:');
        console.log(`   Total emails processed: ${totalProcessed}`);
        console.log(`   Tickets created: ${ticketsCreated}`);
        console.log(`   Emails skipped (spam filter): ${emailsSkipped}`);
        console.log(`   Errors: ${errors.length}`);

        return Response.json({
            success: true,
            summary: {
                total_processed: totalProcessed,
                tickets_created: ticketsCreated,
                emails_skipped: emailsSkipped,
                errors_count: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('❌ Process service emails error:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});