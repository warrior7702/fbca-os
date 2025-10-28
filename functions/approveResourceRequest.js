import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function refreshTokenIfNeeded(base44, user) {
    const expiresAt = new Date(user.pco_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
        return user.pco_access_token;
    }

    console.log('Refreshing PCO token...');

    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
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
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get full user data with service role to access tokens
        const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
        const user = users[0];

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'Planning Center not connected' }, { status: 400 });
        }

        const { request_id } = await req.json();

        if (!request_id) {
            return Response.json({ error: 'Missing request_id' }, { status: 400 });
        }

        console.log('🔵 Starting approval process for request:', request_id);

        // Refresh token if needed
        const accessToken = await refreshTokenIfNeeded(base44, user);
        console.log('🔵 Token ready:', accessToken ? 'YES' : 'NO');

        // First, let's check the current status
        const checkResponse = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            console.log('🔵 Current request data:', {
                id: checkData.data?.id,
                approval_status: checkData.data?.attributes?.approval_status,
                resource_id: checkData.data?.relationships?.resource?.data?.id
            });
        }

        // Approve the resource request in PCO
        console.log('🔵 Sending PATCH request to approve...');
        const response = await fetch(
            `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        type: 'EventResourceRequest',
                        id: request_id,
                        attributes: {
                            approval_status: 'A'
                        }
                    }
                })
            }
        );

        console.log('🔵 Response status:', response.status);
        
        const responseText = await response.text();
        console.log('🔵 Response body:', responseText);

        if (!response.ok) {
            console.error('❌ PCO approval failed:', responseText);
            return Response.json({ 
                error: 'Failed to approve in PCO',
                details: responseText,
                status: response.status
            }, { status: 500 });
        }

        const data = JSON.parse(responseText);
        console.log('✅ PCO approval successful. New status:', data.data?.attributes?.approval_status);

        return Response.json({ 
            success: true,
            data: data,
            new_status: data.data?.attributes?.approval_status
        });

    } catch (error) {
        console.error('❌ Approve request error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});