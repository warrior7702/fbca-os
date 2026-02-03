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

        // Get user profile
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${user.microsoft_access_token}`
            }
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error('Microsoft Graph API error:', errorText);
            return Response.json({ error: 'Failed to fetch Microsoft data' }, { status: 500 });
        }

        const userData = await userResponse.json();

        // Get recent emails (top 5)
        const emailsResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=subject,from,receivedDateTime', {
            headers: {
                'Authorization': `Bearer ${user.microsoft_access_token}`
            }
        });

        let emails = [];
        if (emailsResponse.ok) {
            const emailsData = await emailsResponse.json();
            emails = emailsData.value.map(email => ({
                subject: email.subject,
                from: email.from?.emailAddress?.address,
                received: email.receivedDateTime
            }));
        }

        return Response.json({
            success: true,
            user: userData,
            emails: emails
        });

    } catch (error) {
        console.error('Test Microsoft error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});