
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

    const token = user.pco_access_token;

    // Fetch upcoming events from PCO
    const eventsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&per_page=100&order=starts_at',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
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
              'Authorization': `Bearer ${token}`,
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              let eventDetails = null;
              let ownerEmail = null;
              let ownerName = null;
              
              if (eventResponse.ok) {
                const eventData = await eventResponse.json();
                eventDetails = eventData.data?.attributes;
                
                // Get owner ID
                const ownerId = eventData.data?.relationships?.owner?.data?.id;
                ownerName = eventData.data?.attributes?.owner_name;
                
                // Try to fetch owner email from PCO
                if (ownerId) {
                  console.log('👤 Fetching owner email for ID:', ownerId);
                  
                  // Try Calendar API first
                  const ownerResponse = await fetch(
                    `https://api.planningcenteronline.com/calendar/v2/people/${ownerId}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );
                  
                  if (ownerResponse.ok) {
                    const ownerData = await ownerResponse.json();
                    ownerEmail = ownerData.data?.attributes?.email;
                    console.log('📧 Found email in Calendar API:', ownerEmail);
                  }
                  
                  // If no email, try People API
                  if (!ownerEmail) {
                    console.log('🔍 No email in Calendar API, trying People API...');
                    const peopleResponse = await fetch(
                      `https://api.planningcenteronline.com/people/v2/people/${ownerId}?include=emails`,
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );
                    
                    if (peopleResponse.ok) {
                      const peopleData = await peopleResponse.json();
                      
                      // Look for primary email
                      if (peopleData.included && peopleData.included.length > 0) {
                        const primaryEmail = peopleData.included.find(item => 
                          item.type === 'Email' && item.attributes?.primary
                        );
                        if (primaryEmail) {
                          ownerEmail = primaryEmail.attributes?.address;
                          console.log('✅ Found primary email in People API:', ownerEmail);
                        } else if (peopleData.included[0]?.attributes?.address) {
                          ownerEmail = peopleData.included[0].attributes.address;
                          console.log('✅ Found first email in People API:', ownerEmail);
                        }
                      }
                    }
                  }
                }
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
                owner_email: ownerEmail,
                owner_name: ownerName || 'Unknown'
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
    const emailResults = [];
    
    for (const mysteryReq of mysteryResourceRequests) {
      // Skip if we already have a workflow for this PCO request
      if (existingPCORequestIds.includes(mysteryReq.request_id)) {
        console.log(`⏭️ Skipping duplicate request: ${mysteryReq.request_id}`);
        continue;
      }

      // Generate request number
      const requestNumber = `CR-${Date.now().toString().slice(-6)}`;

      console.log(`📝 Creating new request: ${requestNumber}`);
      console.log(`   Event: ${mysteryReq.event_name}`);
      console.log(`   Owner: ${mysteryReq.owner_name} (${mysteryReq.owner_email})`);

      try {
        // Create communication request - CHANGED: Set status to minister_goal_review
        const commRequest = await base44.asServiceRole.entities.WorkflowRequest.create({
          request_number: requestNumber,
          type: 'mystery_resource',
          status: 'minister_goal_review', // CHANGED: Move directly to goal review
          priority: 'medium',
          title: mysteryReq.event_name,
          description: `Communications request automatically created from PCO Calendar event`,
          requestor_email: mysteryReq.owner_email || user.email,
          requestor_name: mysteryReq.owner_name,
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

        // Send email notification to event owner if we have their email
        if (mysteryReq.owner_email) {
          try {
            console.log('📧 Sending email to:', mysteryReq.owner_email);
            
            const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'Communications Team',
              to: mysteryReq.owner_email,
              subject: `Communications Request: ${mysteryReq.event_name}`,
              body: `Hello ${mysteryReq.owner_name},

A communications request has been created for your event:

Request Number: ${requestNumber}
Event: ${mysteryReq.event_name}
Date: ${mysteryReq.event_start ? new Date(mysteryReq.event_start).toLocaleDateString() : 'TBD'}

Your request is now in Minister Goal Review. Our communications team will reach out to discuss your ministry goals and needs for this event.

Request Details:
- Automatically created from PCO Calendar
- Resource: Mystery Resource

Thank you!
Communications Team`
            });

            console.log('✅ Email sent successfully to:', mysteryReq.owner_email);
            emailResults.push({
              request_id: commRequest.id,
              email_sent: true,
              recipient: mysteryReq.owner_email
            });
          } catch (emailError) {
            console.error('❌ Failed to send email:', emailError.message);
            emailResults.push({
              request_id: commRequest.id,
              email_sent: false,
              error: emailError.message
            });
            // Continue - email failure shouldn't block request creation
          }
        } else {
          console.warn('⚠️ No owner email found, skipping email notification');
          emailResults.push({
            request_id: commRequest.id,
            email_sent: false,
            error: 'No owner email found'
          });
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
      new_requests: newRequests,
      emails_sent: emailResults.filter(r => r.email_sent).length,
      email_results: emailResults
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
