import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userEmail } = await req.json();

    if (!userEmail) {
      return Response.json({ 
        success: false, 
        error: 'User email is required' 
      }, { status: 400 });
    }

    // Get SSO access token
    const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!accessToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft account not connected' 
      }, { status: 403 });
    }

    // Get user's booking page
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/getSchedule`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schedules: [userEmail],
          startTime: {
            dateTime: new Date().toISOString(),
            timeZone: 'UTC'
          },
          endTime: {
            dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            timeZone: 'UTC'
          },
          availabilityViewInterval: 30
        })
      }
    );

    if (!response.ok) {
      console.error('Failed to get schedule:', response.status, await response.text());
    }

    // Define standard personal booking options
    const bookingOptions = [
      {
        id: '15min',
        name: '15 Minute Meeting',
        duration: 15,
        description: 'Quick sync or check-in'
      },
      {
        id: '30min',
        name: '30 Minute Meeting',
        duration: 30,
        description: 'Standard meeting'
      },
      {
        id: '45min',
        name: '45 Minute Meeting',
        duration: 45,
        description: 'Detailed discussion'
      },
      {
        id: '60min',
        name: '1 Hour Meeting',
        duration: 60,
        description: 'Extended session'
      }
    ];

    return Response.json({
      success: true,
      options: bookingOptions,
      userEmail,
      userName: userEmail.split('@')[0]
    });

  } catch (error) {
    console.error('Error in getUserBookingOptions:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});