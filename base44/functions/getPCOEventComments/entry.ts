import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.pco_refresh_token,
            client_id: Deno.env.get('PCO_CLIENT_ID'),
            client_secret: Deno.env.get('PCO_CLIENT_SECRET')
        })
    });

    if (!tokenResponse.ok) throw new Error('Token refresh failed');

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await base44.asServiceRole.entities.User.update(user.id, {
        pco_access_token: tokens.access_token,
        pco_refresh_token: tokens.refresh_token,
        pco_token_expires_at: newExpiresAt
    });

    return tokens.access_token;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'PCO not connected' }, { status: 400 });
        }

        const { event_id } = await req.json();

        if (!event_id) {
            return Response.json({ error: 'event_id required' }, { status: 400 });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);

        // Fetch event comments/activity
        const commentsResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/events/${event_id}/event_comments?per_page=100`,
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!commentsResponse.ok) {
            console.error('Failed to fetch comments:', await commentsResponse.text());
            return Response.json({ comments: [] });
        }

        const commentsData = await commentsResponse.json();
        const comments = (commentsData.data || []).map(comment => ({
            id: comment.id,
            body: comment.attributes?.body,
            created_at: comment.attributes?.created_at,
            person_name: comment.relationships?.person?.data?.id
        }));

        // Extract door codes from comments
        const doorCodes = comments
            .filter(comment => comment.body?.includes('Door Code:'))
            .map(comment => {
                const match = comment.body.match(/Door Code:\s*(\d+#?)/);
                return match ? match[1] : null;
            })
            .filter(code => code);

        return Response.json({ 
            comments,
            door_codes: doorCodes,
            latest_door_code: doorCodes[doorCodes.length - 1] || null
        });

    } catch (error) {
        console.error('Get event comments error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});