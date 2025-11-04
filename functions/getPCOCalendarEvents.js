import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    console.log('🔄 Refreshing PCO token...');

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

    if (!tokenResponse.ok) {
        throw new Error('PCO token refresh failed');
    }

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
            console.error('❌ No current user');
            return Response.json({ events: [] });
        }

        console.log('✅ Current user:', currentUser.email);

        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            console.error('❌ No PCO token for user');
            return Response.json({ events: [] });
        }

        const accessToken = await refreshTokenIfNeeded(base44, user);
        console.log('✅ Access token ready');

        // SIMPLIFIED: Fetch ONLY 14 days ahead
        const now = new Date();
        const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
        
        const startDate = now.toISOString();
        const endDate = twoWeeksFromNow.toISOString();

        console.log('📅 Fetching events from', startDate, 'to', endDate);

        // SIMPLIFIED: Just get event instances without includes
        const url = `https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&filter[starts_at][gte]=${startDate}&filter[starts_at][lte]=${endDate}&order=starts_at&per_page=100`;
        
        console.log('🔗 Fetching...');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ PCO fetch failed:', response.status, errorText);
            return Response.json({ events: [] });
        }

        const data = await response.json();
        const instances = data.data || [];
        
        console.log('📦 Got', instances.length, 'event instances');
        
        if (instances.length === 0) {
            return Response.json({ events: [] });
        }

        // Build simple events list with basic data only
        const events = instances.map(instance => {
            const eventId = instance.relationships?.event?.data?.id;
            
            return {
                id: instance.id,
                event_id: eventId,
                name: instance.attributes?.all_day_or_multi_day || 'Event',
                starts_at: instance.attributes?.starts_at,
                ends_at: instance.attributes?.ends_at,
                resources: [], // Will be populated on-demand when user clicks
                tags: [],
                resource_count: 0
            };
        });

        console.log('🎯 Returning', events.length, 'events');

        return Response.json({ 
            events: events,
            count: events.length
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        return Response.json({ events: [] });
    }
});