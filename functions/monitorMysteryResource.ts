import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('🔍 Starting Mystery Resource monitor...');
    
    // Try to get authenticated user first (for manual triggers)
    let user = null;
    let token = null;
    
    try {
      user = await base44.auth.me();
      if (user?.pco_access_token) {
        token = user.pco_access_token;
        console.log('👤 Using user token:', user.email);
      }
    } catch (authError) {
      console.log('⚙️ No user auth, will use service role');
    }
    
    // If no user token, get PCO token from admin/super_user in database
    if (!token) {
      const users = await base44.asServiceRole.entities.User.filter({
        pco_access_token: { $exists: true, $ne: null }
      });
      
      const adminUser = users.find(u => u.role === 'super_user' || u.role === 'admin') || users[0];
      
      if (!adminUser?.pco_access_token) {
        return Response.json({ 
          error: 'No PCO access available - no users with PCO tokens found' 
        }, { status: 401 });
      }
      
      token = adminUser.pco_access_token;
      user = adminUser;
      console.log('🔑 Using service role with admin user token:', adminUser.email);
    }
    // Add baseUrl to be used in the email template
    const baseUrl = Deno.env.get('BASE44_APP_URL') || 'https://workflow-hub-6a5c78c9.base44.app';

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

      let commRequest = null;
      let emailSent = false;
      let emailError = null;

      try {
        // Create communication request 
        commRequest = await base44.asServiceRole.entities.WorkflowRequest.create({
          request_number: requestNumber,
          type: 'mystery_resource',
          status: 'minister_goal_review', // Move directly to goal review
          priority: 'medium',
          title: mysteryReq.event_name,
          description: `Communications request automatically created from PCO Calendar event`,
          requestor_email: mysteryReq.owner_email || user.email,
          requestor_name: mysteryReq.owner_name,
          pco_event_id: mysteryReq.event_id,
          pco_event_name: mysteryReq.event_name,
          pco_event_date: mysteryReq.event_start,
          pco_resource_request_id: mysteryReq.request_id,
          email_sent: false, // Initialize as false
          email_sent_at: null,
          email_error: null,
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
            console.log('📧 Attempting to send email to:', mysteryReq.owner_email);
            const intakeLink = `${baseUrl}/workflowdetail?id=${commRequest.id}`;
            
            const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'FBC Arlington Communications',
              to: mysteryReq.owner_email,
              subject: `📋 Communications Review and Planning: ${mysteryReq.event_name}`,
              body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Communications Review and Planning</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f8fa; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f7f8fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.15); width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">📋</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Communications Review and Planning</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Action Required</p>
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding: 40px 30px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Hi <strong>${mysteryReq.owner_name}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Lets take some time to learn more about your Communications needs
              </p>
              
              <!-- Request Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📅 Project</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">${mysteryReq.event_name}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🏢 Ministry</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">TBD</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Request #</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace;">${requestNumber}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Step Section -->
              <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 700;">✨ Next Step: Complete Your Minister Goal Review</h2>
                <p style="margin: 0 0 24px; color: rgba(255, 255, 255, 0.95); font-size: 14px; line-height: 1.6;">
                  We've streamlined our process with a quick 5-minute interview that will gather all the details we need to create the perfect communications plan.
                </p>
                <a href="${intakeLink}" style="display: inline-block; background-color: #ffffff; color: #7c3aed; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  Start Your Goal Review →
                </a>
              </div>
              
              <!-- What to Expect -->
              <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 17px; font-weight: 700;">What to expect:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Quick Q&A about your event (5 minutes)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Questions about theme, audience, goals, and logistics</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">No need to prepare - just answer naturally</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">You can skip questions if unsure</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- After Completion -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 12px; color: #166534; font-size: 16px; font-weight: 700;">After you complete the intake:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Our communications team will review your responses</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">We'll create a detailed project plan</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Tasks will be assigned to our design & marketing team</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">You'll be able to track progress in real-time</span>
                    </td>
                  </tr>
                </table>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
                Questions? Contact us at
              </p>
              <p style="margin: 0 0 20px;">
                <a href="mailto:kyle.judkins@fbca.org" style="color: #7c3aed; text-decoration: none; font-weight: 600; font-size: 15px;">
                  📧 kyle.judkins@fbca.org
                </a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                Looking forward to making your project a success!<br>
                <strong style="color: #64748b;">— Communications Team, FBC Arlington</strong>
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Unsubscribe Footer -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                This is an automated notification from FBC Arlington Communications Team.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`
            });

            emailSent = true;
            console.log('✅ Email sent successfully to:', mysteryReq.owner_email);
            
            emailResults.push({
              request_id: commRequest.id,
              email_sent: true,
              recipient: mysteryReq.owner_email,
              timestamp: new Date().toISOString()
            });

            // Update the workflow request with email success
            await base44.asServiceRole.entities.WorkflowRequest.update(commRequest.id, {
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              email_error: null
            });

          } catch (emailError) {
            const errorMessage = emailError.message || 'Unknown email error';
            console.error('❌ Failed to send email:', errorMessage);
            console.error('Email error details:', emailError);
            
            emailResults.push({
              request_id: commRequest.id,
              email_sent: false,
              error: errorMessage,
              recipient: mysteryReq.owner_email
            });

            // Update the workflow request with email failure details
            await base44.asServiceRole.entities.WorkflowRequest.update(commRequest.id, {
              email_sent: false,
              email_sent_at: null,
              email_error: `Failed to send email: ${errorMessage}`
            });
          }
        } else {
          const errorMessage = 'No owner email found in PCO';
          console.warn('⚠️', errorMessage);
          
          emailResults.push({
            request_id: commRequest.id,
            email_sent: false,
            error: errorMessage
          });

          // Update the workflow request with no email reason
          await base44.asServiceRole.entities.WorkflowRequest.update(commRequest.id, {
            email_sent: false,
            email_sent_at: null,
            email_error: errorMessage
          });
        }
      } catch (createError) {
        console.error('❌ Failed to create request:', createError.message);
        console.error('Creation error details:', createError);
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