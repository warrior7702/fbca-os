import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ssoAuthorization = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!ssoAuthorization) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    console.log('📅 Fetching calendar events to detect bookings...');

    // Fetch calendar events for the past month and next 2 months
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);

    const calendarUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
    calendarUrl.searchParams.set('startDateTime', startDate.toISOString());
    calendarUrl.searchParams.set('endDateTime', endDate.toISOString());
    calendarUrl.searchParams.set('$top', '100');
    calendarUrl.searchParams.set('$orderby', 'start/dateTime');

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        'Authorization': ssoAuthorization,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Calendar API error:', errorText);
      return Response.json({ error: 'Failed to fetch calendar' }, { status: 500 });
    }

    const data = await response.json();
    const allEvents = data.value || [];
    
    console.log(`✅ Fetched ${allEvents.length} calendar events`);

    // Filter for Bookings-with-Me events using patterns
    const bookingEvents = allEvents.filter(evt => {
      const subject = (evt.subject || '').toLowerCase();
      const bodyPreview = (evt.bodyPreview || '').toLowerCase();
      const categories = evt.categories || [];
      
      // Check for booking indicators
      const hasBookingCategory = categories.some(c => 
        c.toLowerCase().includes('booking') || 
        c.toLowerCase().includes('book with me')
      );
      
      const hasBookingSubject = 
        subject.includes('scheduled with') ||
        subject.includes('booked with') ||
        subject.includes('booking for') ||
        subject.includes('book with me');
      
      const hasBookingBody = 
        bodyPreview.includes('booking') ||
        bodyPreview.includes('scheduled via') ||
        bodyPreview.includes('book with me');
      
      // Must be an online meeting or have external attendees
      const isOnlineMeeting = evt.isOnlineMeeting === true;
      const hasExternalAttendees = evt.attendees?.some(att => 
        !att.emailAddress?.address?.endsWith('@fbca.org')
      );
      
      return (hasBookingCategory || hasBookingSubject || hasBookingBody) && 
             (isOnlineMeeting || hasExternalAttendees);
    });

    console.log(`🎯 Found ${bookingEvents.length} booking events`);

    // Format booking events
    const bookings = bookingEvents.map(evt => ({
      id: evt.id,
      title: evt.subject,
      start: evt.start?.dateTime,
      end: evt.end?.dateTime,
      timeZone: evt.start?.timeZone || 'UTC',
      customerEmail: evt.attendees?.find(att => 
        !att.emailAddress?.address?.endsWith('@fbca.org')
      )?.emailAddress?.address || null,
      customerName: evt.attendees?.find(att => 
        !att.emailAddress?.address?.endsWith('@fbca.org')
      )?.emailAddress?.name || null,
      location: evt.location?.displayName || null,
      isOnlineMeeting: evt.isOnlineMeeting,
      meetingLink: evt.onlineMeeting?.joinUrl || null,
      bodyPreview: evt.bodyPreview,
      categories: evt.categories || [],
      allAttendees: evt.attendees?.map(att => ({
        name: att.emailAddress?.name,
        email: att.emailAddress?.address,
        status: att.status?.response
      })) || []
    }));

    return Response.json({
      success: true,
      bookings,
      totalScanned: allEvents.length,
      totalBookings: bookings.length
    });

  } catch (error) {
    console.error('❌ Get my bookings error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});