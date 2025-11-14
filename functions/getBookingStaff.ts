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

    // Get staff members
    const staffResponse = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${businessId}/staffMembers`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!staffResponse.ok) {
      const errorText = await staffResponse.text();
      console.error('Staff API error:', errorText);
      return Response.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    const staffData = await staffResponse.json();
    const staff = staffData.value || [];

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

    let services = [];
    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      services = servicesData.value || [];
    }

    return Response.json({
      success: true,
      staff,
      services
    });

  } catch (error) {
    console.error('Get booking staff error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});