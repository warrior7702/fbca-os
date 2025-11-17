import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!accessToken) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    const { businessId } = await req.json();

    if (!businessId) {
      return Response.json({ error: 'businessId required' }, { status: 400 });
    }

    // Get services
    const servicesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${businessId}/services`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!servicesResponse.ok) {
      const errorText = await servicesResponse.text();
      console.error('Services API error:', errorText);
      return Response.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    const servicesData = await servicesResponse.json();

    return Response.json({
      success: true,
      services: servicesData.value || []
    });

  } catch (error) {
    console.error('Get booking services error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});