import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.microsoft_access_token) {
            return Response.json({ error: 'Microsoft 365 not connected' }, { status: 400 });
        }

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Get focused inbox (important emails) - expanded selection
        const focusedResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/messages?$filter=inferenceClassification eq \'focused\'&$top=10&$select=subject,from,receivedDateTime,isRead,hasAttachments,importance,categories&$orderby=receivedDateTime desc',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        // Get flagged emails - expanded selection
        const flaggedResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/messages?$filter=flag/flagStatus eq \'flagged\'&$top=10&$select=subject,from,receivedDateTime,isRead,hasAttachments,importance,categories&$orderby=receivedDateTime desc',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        // Get categorized emails
        const categorizedResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/messages?$filter=categories/any(c: c ne null)&$top=20&$select=subject,from,receivedDateTime,isRead,hasAttachments,importance,categories&$orderby=receivedDateTime desc',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        const focused = focusedResponse.ok ? (await focusedResponse.json()).value : [];
        const flagged = flaggedResponse.ok ? (await flaggedResponse.json()).value : [];
        const categorized = categorizedResponse.ok ? (await categorizedResponse.json()).value : [];

        // Group categorized emails by category
        const emailsByCategory = {};
        categorized.forEach(email => {
            if (email.categories && email.categories.length > 0) {
                email.categories.forEach(category => {
                    if (!emailsByCategory[category]) {
                        emailsByCategory[category] = [];
                    }
                    emailsByCategory[category].push({
                        subject: email.subject,
                        from: email.from?.emailAddress?.address,
                        fromName: email.from?.emailAddress?.name,
                        receivedAt: email.receivedDateTime,
                        isRead: email.isRead,
                        hasAttachments: email.hasAttachments,
                        importance: email.importance,
                        categories: email.categories
                    });
                });
            }
        });

        return Response.json({
            focused: focused.map(email => ({
                subject: email.subject,
                from: email.from?.emailAddress?.address,
                fromName: email.from?.emailAddress?.name,
                receivedAt: email.receivedDateTime,
                isRead: email.isRead,
                hasAttachments: email.hasAttachments,
                importance: email.importance,
                categories: email.categories || []
            })),
            flagged: flagged.map(email => ({
                subject: email.subject,
                from: email.from?.emailAddress?.address,
                fromName: email.from?.emailAddress?.name,
                receivedAt: email.receivedDateTime,
                isRead: email.isRead,
                hasAttachments: email.hasAttachments,
                importance: email.importance,
                categories: email.categories || []
            })),
            categorized: emailsByCategory
        });

    } catch (error) {
        console.error('Get categorized emails error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});