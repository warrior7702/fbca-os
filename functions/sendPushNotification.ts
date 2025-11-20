import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import webpush from 'npm:web-push@3.6.7';

// VAPID keys - you'll need to generate these once
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'YOUR_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'YOUR_PRIVATE_KEY';

webpush.setVapidDetails(
  'mailto:support@fbca.org',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_email, title, body, data } = await req.json();

    // Get all push subscriptions for this user
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        return webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title,
            body,
            data,
            icon: '/icon-192.png',
            badge: '/badge-72.png'
          })
        );
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return Response.json({
      success: true,
      sent: successful,
      failed
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});