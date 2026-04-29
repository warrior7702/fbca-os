import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.pco_access_token) {
            return Response.json({ error: 'Planning Center not connected' }, { status: 400 });
        }

        // Allow custom endpoint via request body
        const { endpoint } = await req.json().catch(() => ({}));
        
        const testEndpoint = endpoint || '/people/v2/me';
        const fullUrl = testEndpoint.startsWith('http') 
            ? testEndpoint 
            : `https://api.planningcenteronline.com${testEndpoint}`;

        const response = await fetch(fullUrl, {
            headers: {
                'Authorization': `Bearer ${user.pco_access_token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PCO API error:', errorText);
            return Response.json({ 
                error: 'Failed to fetch Planning Center data',
                status: response.status,
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();

        return Response.json({
            success: true,
            endpoint: testEndpoint,
            data: data
        });

    } catch (error) {
        console.error('Test PCO error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});