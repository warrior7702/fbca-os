import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id } = await req.json();
    
    if (!request_id) {
      return Response.json({ error: 'request_id required' }, { status: 400 });
    }

    console.log('📧 Resending intake email for request:', request_id);

    // Fetch the request
    const requests = await base44.asServiceRole.entities.WorkflowRequest.filter({ id: request_id });
    
    if (!requests || requests.length === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    const request = requests[0];
    
    if (!request.requestor_email) {
      return Response.json({ error: 'No requestor email found' }, { status: 400 });
    }

    const baseUrl = Deno.env.get('BASE44_APP_URL') || 'https://workflow-hub-6a5c78c9.base44.app';
    const intakeLink = `${baseUrl}/workflowdetail?id=${request.id}`;
    
    console.log('📬 Sending to:', request.requestor_email);
    console.log('🔗 Link:', intakeLink);

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'FBC Arlington Communications',
        to: request.requestor_email,
        subject: `📋 Action Required: Complete Communications Intake for ${request.title}`,
        body: `Hi ${request.requestor_name || 'there'},

Thank you for requesting communications support for your event! We're excited to help you create an amazing experience.

📅 EVENT: ${request.title}
${request.pco_event_date ? `🗓️ DATE: ${new Date(request.pco_event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
📋 REQUEST #: ${request.request_number}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ NEXT STEP: Complete Your AI-Powered Intake

We've streamlined our process with a quick 5-minute AI interview that will gather all the details we need to create the perfect communications plan for your event.

👉 Click here to start your intake:
${intakeLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What to expect:
• Quick Q&A about your event (5 minutes)
• Questions about theme, audience, goals, and logistics
• No need to prepare - just answer naturally
• You can skip questions if unsure

After you complete the intake:
✅ Our communications team will review your responses
✅ We'll create a detailed project plan
✅ Tasks will be assigned to our design & marketing team
✅ You'll be able to track progress in real-time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? Reply to this email or contact:
📧 communications@fbcarlington.org

Looking forward to making your event a success!

— Communications Team
FBC Arlington`
      });

      // Update request with email status
      await base44.asServiceRole.entities.WorkflowRequest.update(request_id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_error: null
      });

      console.log('✅ Email sent successfully!');

      return Response.json({
        success: true,
        email_sent_to: request.requestor_email,
        request_number: request.request_number,
        sent_at: new Date().toISOString()
      });

    } catch (emailError) {
      console.error('❌ Email send failed:', emailError);
      
      // Log the error in the request
      await base44.asServiceRole.entities.WorkflowRequest.update(request_id, {
        email_sent: false,
        email_error: emailError.message
      });

      return Response.json({ 
        error: 'Failed to send email',
        details: emailError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});