import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return Response.json({ 
        error: 'Missing required field: request_id' 
      }, { status: 400 });
    }

    // Fetch the communication request
    const requests = await base44.asServiceRole.entities.WorkflowRequest.filter({ id: request_id });
    
    if (!requests || requests.length === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    const commRequest = requests[0];

    // Get the event owner's email from the request
    const recipientEmail = commRequest.requestor_email;
    
    if (!recipientEmail) {
      return Response.json({ error: 'No requestor email found on request' }, { status: 400 });
    }

    // Simple test email
    const emailSubject = `Communications Request: ${commRequest.title}`;
    const emailBody = `Testing from Base44 Communications ticket

Request Number: ${commRequest.request_number}
Event: ${commRequest.pco_event_name || commRequest.title}
Requestor: ${commRequest.requestor_name}

This is a test email notification from the Communications Request system.`;

    console.log('📧 Sending email to:', recipientEmail);
    console.log('📋 Request:', commRequest.request_number);

    // Send email using Base44 Core integration
    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'Communications Team',
      to: recipientEmail,
      subject: emailSubject,
      body: emailBody
    });

    console.log('✅ Email sent successfully');

    return Response.json({
      success: true,
      email_sent: true,
      recipient: recipientEmail,
      request_number: commRequest.request_number,
      request_title: commRequest.title
    });

  } catch (error) {
    console.error('❌ Error sending communication request email:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to send email notification'
    }, { status: 500 });
  }
});