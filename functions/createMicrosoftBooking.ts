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

    const { businessId, serviceId, staffMemberId, startDateTime, endDateTime, customerName, customerEmail, notes } = await req.json();

    if (!businessId || !serviceId || !startDateTime || !endDateTime) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const bookingData = {
      customerEmailAddress: customerEmail || user.email,
      customerName: customerName || user.full_name,
      customerNotes: notes || '',
      serviceId: serviceId,
      start: {
        dateTime: startDateTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'UTC'
      }
    };

    if (staffMemberId) {
      bookingData.staffMemberIds = [staffMemberId];
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${businessId}/appointments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create booking error:', errorText);
      return Response.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    const appointment = await response.json();

    return Response.json({
      success: true,
      appointment
    });

  } catch (error) {
    console.error('Create Microsoft Booking error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});