import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { request_id, recipient_email } = body;

    if (!request_id || !recipient_email) {
      return Response.json({ 
        error: 'Missing required fields: request_id and recipient_email' 
      }, { status: 400 });
    }

    // Fetch the communication request
    const request = await base44.asServiceRole.entities.WorkflowRequest.filter({ id: request_id });
    
    if (!request || request.length === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    const commRequest = request[0];

    // Build email content based on request type
    let emailSubject = '';
    let emailBody = '';

    if (commRequest.type === 'mystery_resource') {
      emailSubject = `Communications Request Created: ${commRequest.title}`;
      emailBody = `
Hello ${commRequest.requestor_name},

Your communications request has been created automatically from your Planning Center Calendar event.

Request Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Request Number: ${commRequest.request_number}
Event: ${commRequest.pco_event_name}
Event Date: ${commRequest.pco_event_date ? new Date(commRequest.pco_event_date).toLocaleDateString() : 'Not specified'}
Status: Minister Goal Review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Steps:
Your request will go through the following workflow:
1. Minister Goal Review - Define your ministry goals and objectives
2. Project Review - Communications team reviews project scope
3. Campaign Running - Active execution and delivery

You can view and update your request at any time in the Communications Request portal.

Questions? Reply to this email or contact the communications team.

Best regards,
Communications Team
      `.trim();
    } else {
      emailSubject = `Communications Request: ${commRequest.title}`;
      emailBody = `
Hello ${commRequest.requestor_name},

Your communications request has been received.

Request Number: ${commRequest.request_number}
Title: ${commRequest.title}
Status: ${commRequest.status}

You can view and manage your request in the Communications Request portal.

Best regards,
Communications Team
      `.trim();
    }

    // Send email using Base44 Core integration
    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'Communications Team',
      to: recipient_email,
      subject: emailSubject,
      body: emailBody
    });

    return Response.json({
      success: true,
      email_sent: true,
      recipient: recipient_email,
      request_number: commRequest.request_number
    });

  } catch (error) {
    console.error('Error sending communication request email:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to send email notification'
    }, { status: 500 });
  }
});