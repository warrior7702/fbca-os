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

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail required' }, { status: 400 });
    }

    // Check if user has Bookings business
    const businessesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${targetUserEmail}/bookingBusinesses`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let hasBookings = false;
    let bookingBusiness = null;

    if (businessesResponse.ok) {
      const businessesData = await businessesResponse.json();
      if (businessesData.value && businessesData.value.length > 0) {
        hasBookings = true;
        bookingBusiness = businessesData.value[0];
      }
    }

    return Response.json({
      success: true,
      hasBookings,
      bookingBusiness,
      userEmail: targetUserEmail
    });

  } catch (error) {
    console.error('Check booking availability error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});