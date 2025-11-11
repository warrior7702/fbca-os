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

    // Fetch all pending resource requests from PCO
    const pcoResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/resource_requests?filter=pending&per_page=100',
      {
        headers: {
          'Authorization': `Bearer ${user.pco_access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!pcoResponse.ok) {
      console.error('❌ PCO API error:', pcoResponse.status);
      throw new Error(`PCO API error: ${pcoResponse.status}`);
    }

    const data = await pcoResponse.json();
    const resourceRequests = data.data || [];
    console.log(`📋 Found ${resourceRequests.length} pending resource requests`);

    // Fetch resource details to find "Mystery Resource"
    const mysteryResourceRequests = [];

    for (const request of resourceRequests) {
      const resourceId = request.relationships?.resource?.data?.id;
      
      if (resourceId) {
        // Fetch resource details
        const resourceResponse = await fetch(
          `https://api.planningcenteronline.com/calendar/v2/resources/${resourceId}`,
          {
            headers: {
              'Authorization': `Bearer ${user.pco_access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (resourceResponse.ok) {
          const resourceData = await resourceResponse.json();
          const resourceName = resourceData.data?.attributes?.name || '';

          // Check if this is the Mystery Resource
          if (resourceName.toLowerCase().includes('mystery resource')) {
            console.log('🔮 Found Mystery Resource request:', request.id);
            
            // Fetch event details
            const eventId = request.relationships?.event?.data?.id;
            let eventDetails = null;

            if (eventId) {
              const eventResponse = await fetch(
                `https://api.planningcenteronline.com/calendar/v2/events/${eventId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${user.pco_access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (eventResponse.ok) {
                const eventData = await eventResponse.json();
                eventDetails = eventData.data?.attributes;
              }
            }

            mysteryResourceRequests.push({
              request_id: request.id,
              event_id: eventId,
              event_name: eventDetails?.name || 'Unknown Event',
              event_start: eventDetails?.starts_at,
              created_at: request.attributes?.created_at,
              quantity: request.attributes?.quantity,
              resource_name: resourceName,
              requestor: request.attributes?.created_by || user.full_name
            });
          }
        }
      }
    }

    console.log(`✅ Found ${mysteryResourceRequests.length} Mystery Resource requests`);

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
        console.log('📧 Sending email notification...');
        
        // Use the correct SDK method for calling functions from within functions
        const emailResponse = await base44.functions.invoke('sendCommunicationRequestEmail', {
          request_id: commRequest.id
        });
        
        if (emailResponse.data?.success) {
          console.log('✅ Email sent to:', emailResponse.data.recipient);
        } else {
          console.warn('⚠️ Email send returned non-success:', emailResponse.data);
        }
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError.message);
        // Continue even if email fails - don't block the request creation
      }
    }

    console.log('🎉 Monitor complete!');

    return Response.json({
      success: true,
      found: mysteryResourceRequests.length,
      new_requests_created: newRequests.length,
      existing_requests: existingRequests.length,
      new_requests: newRequests
    });

  } catch (error) {
    console.error('❌ Error monitoring Mystery Resource:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to monitor Mystery Resource requests',
      stack: error.stack
    }, { status: 500 });
  }
});