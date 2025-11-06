import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || !user.pco_access_token) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get one pending request with all its relationships
        const requestsResponse = await fetch(
            'https://api.planningcenteronline.com/calendar/v2/event_resource_requests?where[approval_status]=P&per_page=5&include=event,resource,resource.resource_approval_group',
            {
                headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!requestsResponse.ok) {
            const errorText = await requestsResponse.text();
            return Response.json({ error: 'Failed to fetch', details: errorText }, { status: 500 });
        }

        const requestsData = await requestsResponse.json();

        // Get detailed info on the first "Building Access" resource we find
        const buildingAccessRequests = [];
        
        for (const request of requestsData.data || []) {
            const resourceId = request.relationships?.resource?.data?.id;
            
            // Fetch full resource details
            const resourceResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/resources/${resourceId}?include=resource_approval_group`,
                {
                    headers: {
                        'Authorization': `Bearer ${user.pco_access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (resourceResponse.ok) {
                const resourceData = await resourceResponse.json();
                
                if (resourceData.data?.attributes?.name?.includes('Building Access')) {
                    buildingAccessRequests.push({
                        request: request,
                        resource: resourceData.data,
                        included: resourceData.included
                    });
                }
            }
        }

        return Response.json({
            total_pending: requestsData.data?.length,
            sample_requests: requestsData.data?.slice(0, 3).map(r => ({
                id: r.id,
                type: r.type,
                attributes: r.attributes,
                relationships: r.relationships
            })),
            all_included: requestsData.included,
            building_access_details: buildingAccessRequests
        });

    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});