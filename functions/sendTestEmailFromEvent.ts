import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { event_id, event_name, event_date, owner_email, owner_name } = body;

    if (!event_id || !owner_email) {
      return Response.json({ 
        error: 'Missing required fields: event_id, owner_email' 
      }, { status: 400 });
    }

    console.log('📝 Creating test Communication Request...');
    console.log('Event ID:', event_id);
    console.log('Owner:', owner_name, owner_email);

    // Generate request number
    const requestNumber = `CR-TEST-${Date.now().toString().slice(-6)}`;

    // Create test workflow request using service role
    const testRequest = await base44.asServiceRole.entities.WorkflowRequest.create({
      request_number: requestNumber,
      type: 'mystery_resource',
      status: 'request',
      priority: 'medium',
      title: event_name || 'Test Event',
      description: 'TEST Communication Request - Created from API Tester',
      requestor_email: owner_email,
      requestor_name: owner_name || 'Event Owner',
      pco_event_id: event_id,
      pco_event_name: event_name,
      pco_event_date: event_date
    });

    console.log('✅ Test request created:', testRequest.id);

    // Send email notification
    console.log('📧 Sending test email to:', owner_email);

    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'Communications Team',
      to: owner_email,
      subject: `Communications Request: ${event_name || 'Test Event'}`,
      body: `Testing from Base44 Communications ticket

Request Number: ${requestNumber}
Event: ${event_name || 'Test Event'}
Requestor: ${owner_name || 'Event Owner'}

This is a test email notification from the Communications Request system.

Request ID: ${testRequest.id}
Created from: API Tester`
    });

    console.log('✅ Email sent successfully');

    return Response.json({
      success: true,
      request_id: testRequest.id,
      request_number: requestNumber,
      recipient: owner_email,
      event_name: event_name,
      email_sent: true
    });

  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to create test request and send email'
    }, { status: 500 });
  }
});