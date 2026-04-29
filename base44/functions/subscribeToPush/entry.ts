import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await req.json();

    // Check if subscription already exists
    const existing = await base44.entities.PushSubscription.filter({
      user_email: user.email,
      endpoint: subscription.endpoint
    });

    if (existing.length > 0) {
      return Response.json({ success: true, message: 'Already subscribed' });
    }

    // Save subscription
    await base44.entities.PushSubscription.create({
      user_email: user.email,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get('user-agent') || 'unknown'
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});