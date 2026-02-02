import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const userEmail = body.user_email || body.email || null;
    const conversationReference = body.conversation_reference || body.conversationReference || null;

    if (!userEmail || !conversationReference) {
      return Response.json({ error: 'user_email and conversation_reference are required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    const user = users?.[0];

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const refJson = typeof conversationReference === 'string'
      ? conversationReference
      : JSON.stringify(conversationReference);

    await base44.asServiceRole.entities.User.update(user.id, {
      teams_dm_conversation_reference: refJson,
      teams_dm_last_updated: new Date().toISOString()
    });

    return Response.json({
      success: true,
      user_email: userEmail
    });
  } catch (error) {
    console.error('Error registering Teams DM reference:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
