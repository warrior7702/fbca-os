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

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    console.log(`📅 Date range: ${startISO} to ${endISO}`);

    const calendarUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}&$top=100&$orderby=start/dateTime`;

    console.log('🔗 Calling:', calendarUrl);

    const response = await fetch(calendarUrl, {
      headers: {
        'Authorization': ssoAuthorization,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Calendar API error:', response.status, errorText);
      return Response.json({ 
        success: false,
        error: 'Failed to fetch calendar',
        details: errorText,
        status: response.status
      }, { status: 500 });
    }

    const data = await response.json();
    const allEvents = data.value || [];
    
    console.log(`✅ Fetched ${allEvents.length} calendar events`);

    // Filter for Bookings-with-Me events using patterns
    const bookingEvents = allEvents.filter(evt => {
      try {
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
          att.emailAddress?.address && !att.emailAddress.address.endsWith('@fbca.org')
        );
        
        return (hasBookingCategory || hasBookingSubject || hasBookingBody) && 
               (isOnlineMeeting || hasExternalAttendees);
      } catch (filterError) {
        console.error('Error filtering event:', evt.id, filterError);
        return false;
      }
    });

    console.log(`🎯 Found ${bookingEvents.length} booking events`);

    // Format booking events
    const bookings = bookingEvents.map(evt => {
      try {
        return {
          id: evt.id,
          title: evt.subject || 'Untitled',
          start: evt.start?.dateTime,
          end: evt.end?.dateTime,
          timeZone: evt.start?.timeZone || 'UTC',
          customerEmail: evt.attendees?.find(att => 
            att.emailAddress?.address && !att.emailAddress.address.endsWith('@fbca.org')
          )?.emailAddress?.address || null,
          customerName: evt.attendees?.find(att => 
            att.emailAddress?.address && !att.emailAddress.address.endsWith('@fbca.org')
          )?.emailAddress?.name || null,
          location: evt.location?.displayName || null,
          isOnlineMeeting: evt.isOnlineMeeting || false,
          meetingLink: evt.onlineMeeting?.joinUrl || null,
          bodyPreview: evt.bodyPreview || '',
          categories: evt.categories || [],
          allAttendees: (evt.attendees || []).map(att => ({
            name: att.emailAddress?.name || '',
            email: att.emailAddress?.address || '',
            status: att.status?.response || 'none'
          }))
        };
      } catch (mapError) {
        console.error('Error mapping event:', evt.id, mapError);
        return null;
      }
    }).filter(b => b !== null);

    return Response.json({
      success: true,
      bookings,
      totalScanned: allEvents.length,
      totalBookings: bookings.length
    });

  } catch (error) {
    console.error('❌ Get my bookings error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});