import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if user is authenticated and has PCO access
    const user = await base44.auth.me();
    if (!user || !user.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    console.log('🔍 Starting Mystery Resource monitor...');
    console.log('👤 User:', user.email);

    // Fetch upcoming events from PCO
    const eventsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
      {
        headers: {
          'Authorization': `Bearer ${user.pco_access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('❌ PCO API error:', eventsResponse.status, errorText);
      throw new Error(`PCO API error: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const eventInstances = eventsData.data || [];
    console.log(`📅 Found ${eventInstances.length} upcoming event instances`);

    // Get unique event IDs
    const eventIds = [...new Set(eventInstances.map(instance => 
      instance.relationships?.event?.data?.id
    ).filter(Boolean))];
    
    console.log(`📋 Checking ${eventIds.length} unique events for Mystery Resource...`);

    // Fetch resource requests for each event to find Mystery Resource
    const mysteryResourceRequests = [];

    for (const eventId of eventIds) {
      try {
        // Fetch resource requests for this event
        const resourcesResponse = await fetch(
          `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests?include=resource&per_page=100`,
          {
            headers: {
              'Authorization': `Bearer ${user.pco_access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!resourcesResponse.ok) continue;

        const resourcesData = await resourcesResponse.json();
        const requests = resourcesData.data || [];
        const included = resourcesData.included || [];

        // Check each request for Mystery Resource
        for (const request of requests) {
          const resourceId = request.relationships?.resource?.data?.id;
          const resourceDetails = included.find(r => r.type === 'Resource' && r.id === resourceId);
          const resourceName = resourceDetails?.attributes?.name || '';

          // Check if this is the Mystery Resource and is pending
          if (resourceName.toLowerCase().includes('mystery resource')) {
            const approvalStatus = request.attributes?.approval_status;
            
            // Only process pending requests
            if (approvalStatus === 'P' || !approvalStatus) {
              console.log('🔮 Found Mystery Resource request:', request.id, 'for event:', eventId);
              
              // Fetch event details
              const eventResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              let eventDetails = null;
              if (eventResponse.ok) {
                const eventData = await eventResponse.json();
                eventDetails = eventData.data?.attributes;
              }

              // Find the event instance for start date
              const eventInstance = eventInstances.find(inst => 
                inst.relationships?.event?.data?.id === eventId
              );

              mysteryResourceRequests.push({
                request_id: request.id,
                event_id: eventId,
                event_name: eventDetails?.name || 'Unknown Event',
                event_start: eventInstance?.attributes?.starts_at || eventDetails?.starts_at,
                created_at: request.attributes?.created_at,
                quantity: request.attributes?.quantity,
                resource_name: resourceName,
                requestor: eventDetails?.owner_name || user.full_name
              });
            }
          }
        }
      } catch (eventError) {
        console.error(`Error processing event ${eventId}:`, eventError.message);
        // Continue to next event
      }
    }

    console.log(`✅ Found ${mysteryResourceRequests.length} pending Mystery Resource requests`);

    // Check existing workflow requests to avoid duplicates
    const existingRequests = await base44.asServiceRole.entities.WorkflowRequest.filter({
      type: 'mystery_resource',
      status: { $in: ['request', 'minister_goal_review', 'project_review', 'campaign_running'] }
    });

    const existingPCORequestIds = existingRequests.map(r => r.pco_resource_request_id);
    console.log(`📊 ${existingRequests.length} existing requests in database`);

    // Create new communication requests for mystery resources
    const newRequests = [];
    
    for (const mysteryReq of mysteryResourceRequests) {
      // Skip if we already have a workflow for this PCO request
      if (existingPCORequestIds.includes(mysteryReq.request_id)) {
        console.log(`⏭️ Skipping duplicate request: ${mysteryReq.request_id}`);
        continue;
      }

      // Generate request number
      const requestNumber = `CR-${Date.now().toString().slice(-6)}`;

      console.log(`📝 Creating new request: ${requestNumber}`);

      try {
        // Create communication request
        const commRequest = await base44.asServiceRole.entities.WorkflowRequest.create({
          request_number: requestNumber,
          type: 'mystery_resource',
          status: 'request',
          priority: 'medium',
          title: mysteryReq.event_name,
          description: `Communications request automatically created from PCO Calendar event`,
          requestor_email: user.email,
          requestor_name: mysteryReq.requestor,
          pco_event_id: mysteryReq.event_id,
          pco_event_name: mysteryReq.event_name,
          pco_event_date: mysteryReq.event_start,
          pco_resource_request_id: mysteryReq.request_id,
          conversation_history: [{
            timestamp: new Date().toISOString(),
            author: 'System',
            message: `Request created automatically from PCO Calendar. Event: ${mysteryReq.event_name}`,
            is_internal: false
          }]
        });

        newRequests.push(commRequest);
        console.log(`✅ Created request: ${commRequest.id}`);

        // Send email notification to event owner
        try {
          console.log('📧 Attempting to send email notification...');
          
          const emailFunctionUrl = `${Deno.env.get('BASE44_APP_URL')}/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/sendCommunicationRequestEmail`;
          
          const emailResponse = await fetch(emailFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization') || ''
            },
            body: JSON.stringify({
              request_id: commRequest.id
            })
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            console.log('✅ Email sent successfully:', emailData);
          } else {
            const errorText = await emailResponse.text();
            console.warn('⚠️ Email send failed:', emailResponse.status, errorText);
          }
        } catch (emailError) {
          console.error('❌ Failed to send email:', emailError.message);
          // Continue - email failure shouldn't block request creation
        }
      } catch (createError) {
        console.error('❌ Failed to create request:', createError.message);
        // Continue to next request
      }
    }

    console.log('🎉 Monitor complete!');

    return Response.json({
      success: true,
      events_checked: eventIds.length,
      found: mysteryResourceRequests.length,
      new_requests_created: newRequests.length,
      existing_requests: existingRequests.length,
      new_requests: newRequests
    });

  } catch (error) {
    console.error('❌ Error monitoring Mystery Resource:', error);
    console.error('Stack trace:', error.stack);
    return Response.json({ 
      error: error.message,
      details: 'Failed to monitor Mystery Resource requests',
      stack: error.stack
    }, { status: 500 });
  }
});