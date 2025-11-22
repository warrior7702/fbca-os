import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attendeeEmail, attendeeName, startDateTime, endDateTime, subject, notes } = await req.json();

    if (!attendeeEmail || !startDateTime || !endDateTime) {
      return Response.json({ 
        success: false, 
        error: 'Missing required fields' 
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

    // Create calendar event
    const eventBody = {
      subject: subject || `Meeting with ${attendeeName}`,
      body: {
        contentType: 'HTML',
        content: notes || `Personal meeting booked via FBCA workspace`
      },
      start: {
        dateTime: startDateTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'UTC'
      },
      attendees: [
        {
          emailAddress: {
            address: attendeeEmail,
            name: attendeeName
          },
          type: 'required'
        }
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    };

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create meeting:', response.status, errorText);
      return Response.json({ 
        success: false, 
        error: 'Failed to create meeting',
        details: errorText
      }, { status: response.status });
    }

    const event = await response.json();

    return Response.json({
      success: true,
      event: {
        id: event.id,
        subject: event.subject,
        start: event.start.dateTime,
        end: event.end.dateTime,
        joinUrl: event.onlineMeeting?.joinUrl
      }
    });

  } catch (error) {
    console.error('Error in bookPersonalMeeting:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});