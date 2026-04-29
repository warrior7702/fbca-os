import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email, message } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'user_email is required' }, { status: 400 });
    }

    const proactiveUrl = Deno.env.get('SPARKBOT_PROACTIVE_URL') || '';
    const proactiveSecret = Deno.env.get('SPARKBOT_PROACTIVE_SECRET') || '';

    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    const user = users?.[0];

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const refRaw = user?.teams_dm_conversation_reference || null;
    if (!refRaw) {
      return Response.json({
        error: 'No teams_dm_conversation_reference stored for user',
        has_proactive_url: !!proactiveUrl,
        has_proactive_secret: !!proactiveSecret
      }, { status: 400 });
    }

    const conversationReference =
      typeof refRaw === 'string' ? JSON.parse(refRaw) : refRaw;

    if (!proactiveUrl || !proactiveSecret) {
      return Response.json({
        error: 'Missing SPARKBOT_PROACTIVE_URL or SPARKBOT_PROACTIVE_SECRET',
        has_proactive_url: !!proactiveUrl,
        has_proactive_secret: !!proactiveSecret
      }, { status: 500 });
    }

    const res = await fetch(proactiveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proactiveSecret}`
      },
      body: JSON.stringify({
        conversationReference,
        message: message || 'Test DM from Base44'
      })
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return Response.json({
      success: res.ok,
      status: res.status,
      response: data,
      has_proactive_url: !!proactiveUrl,
      has_proactive_secret: !!proactiveSecret,
      stored_reference: true
    }, { status: res.ok ? 200 : 500 });
  } catch (error) {
    console.error('Error testing Teams DM:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
