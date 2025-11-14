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

    const { personEmail, startDateTime, endDateTime } = await req.json();

    if (!personEmail || !startDateTime || !endDateTime) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get person's calendar events for the time range
    const eventsUrl = `https://graph.microsoft.com/v1.0/users/${personEmail}/calendar/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let isAvailable = true;
    let conflicts = [];
    let outOfOffice = false;

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      const events = eventsData.value || [];
      
      // Check for conflicts
      for (const event of events) {
        if (event.showAs === 'busy' || event.showAs === 'oof' || event.showAs === 'tentative') {
          isAvailable = false;
          conflicts.push({
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            showAs: event.showAs
          });
        }
        
        if (event.showAs === 'oof') {
          outOfOffice = true;
        }
      }
    }

    return Response.json({
      success: true,
      isAvailable,
      conflicts,
      outOfOffice,
      personEmail
    });

  } catch (error) {
    console.error('Check availability error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});