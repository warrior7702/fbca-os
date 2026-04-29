import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Setup Microsoft Graph webhook subscriptions for immediate email notifications
 * This creates subscriptions that notify us when new emails arrive
 */

const MONITORED_MAILBOXES = [
  'maintenance@fbca.org',
  'support@fbca.org',
  'cleaning@fbca.org'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.microsoft_access_token) {
      return Response.json({ 
        error: 'Microsoft 365 not connected' 
      }, { status: 400 });
    }

    // Get app URL from environment or construct it
    const appUrl = Deno.env.get('BASE44_APP_URL') || req.headers.get('origin');
    const webhookUrl = `${appUrl}/functions/emailWebhook`;

    console.log('🔧 Setting up email webhooks...');
    console.log('📍 Webhook URL:', webhookUrl);

    const results = [];

    // Create subscription for each mailbox
    for (const mailbox of MONITORED_MAILBOXES) {
      try {
        console.log(`📬 Creating subscription for ${mailbox}...`);

        // Create webhook subscription
        const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.microsoft_access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeType: 'created',
            notificationUrl: webhookUrl,
            resource: `/users/${mailbox}/messages`,
            expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
            clientState: 'fbca-email-webhook-v1'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`❌ Failed to create subscription for ${mailbox}:`, error);
          results.push({
            mailbox,
            success: false,
            error: error.error?.message || 'Unknown error'
          });
        } else {
          const subscription = await response.json();
          console.log(`✅ Subscription created for ${mailbox}:`, subscription.id);
          results.push({
            mailbox,
            success: true,
            subscriptionId: subscription.id,
            expiresAt: subscription.expirationDateTime
          });
        }
      } catch (error) {
        console.error(`❌ Error setting up webhook for ${mailbox}:`, error);
        results.push({
          mailbox,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return Response.json({
      success: successCount > 0,
      message: `Set up ${successCount} of ${MONITORED_MAILBOXES.length} webhooks`,
      results,
      webhookUrl,
      note: 'Webhooks expire after 3 days and need to be renewed'
    });

  } catch (error) {
    console.error('❌ Setup error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});