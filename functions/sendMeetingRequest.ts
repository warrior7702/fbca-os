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

    const { attendeeEmail, subject, startDateTime, endDateTime, body } = await req.json();

    if (!attendeeEmail || !subject || !startDateTime || !endDateTime) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create calendar event
    const event = {
      subject: subject,
      body: {
        contentType: 'Text',
        content: body || ''
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
            address: attendeeEmail
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
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create event error:', errorText);
      return Response.json({ 
        success: false,
        error: 'Failed to create meeting request',
        details: errorText
      }, { status: 500 });
    }

    const createdEvent = await response.json();

    return Response.json({
      success: true,
      event: createdEvent,
      message: 'Meeting request sent successfully'
    });

  } catch (error) {
    console.error('Send meeting request error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});