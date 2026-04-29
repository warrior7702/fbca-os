import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Microsoft Graph webhook endpoint for immediate email notifications
 * This receives notifications when new emails arrive in monitored mailboxes
 */

const MONITORED_MAILBOXES = [
  'maintenance@fbca.org',
  'support@fbca.org', 
  'cleaning@fbca.org'
];

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle validation request from Microsoft Graph
  if (req.method === 'POST' && url.searchParams.has('validationToken')) {
    const validationToken = url.searchParams.get('validationToken');
    console.log('📋 Webhook validation request received');
    
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Handle webhook notifications
  if (req.method === 'POST') {
    try {
      const base44 = createClientFromRequest(req);
      const notifications = await req.json();
      
      console.log('📧 Received webhook notifications:', notifications.value?.length || 0);

      // Process each notification
      for (const notification of notifications.value || []) {
        console.log('🔔 Processing notification:', {
          resource: notification.resource,
          changeType: notification.changeType
        });

        // Only process "created" notifications (new emails)
        if (notification.changeType === 'created') {
          // Extract mailbox from resource path
          // Resource format: /users/{userEmail}/messages/{messageId}
          const resourceParts = notification.resource.split('/');
          const mailboxEmail = resourceParts[2];
          const messageId = resourceParts[4];

          console.log('📬 New email in:', mailboxEmail);

          // Check if this is a monitored mailbox
          if (MONITORED_MAILBOXES.includes(mailboxEmail)) {
            // Invoke processServiceEmails to handle this specific email
            try {
              await base44.asServiceRole.functions.invoke('processServiceEmails');
              console.log('✅ Processed email notification');
            } catch (error) {
              console.error('❌ Failed to process email:', error);
            }
          }
        }
      }

      return Response.json({ success: true, processed: notifications.value?.length || 0 });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});