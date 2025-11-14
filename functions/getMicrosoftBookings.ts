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

    // Get Bookings businesses
    const businessesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/solutions/bookingBusinesses',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!businessesResponse.ok) {
      const errorText = await businessesResponse.text();
      console.error('Bookings API error:', errorText);
      return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    const businessesData = await businessesResponse.json();
    const businesses = businessesData.value || [];

    // Get appointments from first business
    let appointments = [];
    if (businesses.length > 0) {
      const businessId = businesses[0].id;
      
      const appointmentsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${businessId}/appointments?$filter=start/dateTime ge '${new Date().toISOString()}'`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        appointments = appointmentsData.value || [];
      }
    }

    return Response.json({
      success: true,
      businesses,
      appointments
    });

  } catch (error) {
    console.error('Microsoft Bookings error:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});