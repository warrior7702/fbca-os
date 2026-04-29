import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { 
      user_email, 
      type, 
      title, 
      message, 
      related_ticket_id, 
      related_ticket_number,
      action_url,
      send_email 
    } = await req.json();

    if (!user_email || !type || !title || !message) {
      return Response.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Get user's notification preferences
    const preferences = await base44.asServiceRole.entities.NotificationPreference.filter({
      user_email: user_email
    });
    
    const userPref = preferences[0] || {
      [`${type}_email`]: true,
      [`${type}_inapp`]: true
    };

    // Create in-app notification if enabled
    if (userPref[`${type}_inapp`] !== false) {
      await base44.asServiceRole.entities.Notification.create({
        user_email,
        type,
        title,
        message,
        related_ticket_id,
        related_ticket_number,
        action_url,
        read: false
      });
    }

    // Send email if enabled
    if (send_email && userPref[`${type}_email`] !== false) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user_email,
          subject: title,
          body: `${message}\n\n${action_url ? `View ticket: ${Deno.env.get('BASE44_APP_URL') || ''}${action_url}` : ''}`
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    return Response.json({ 
      success: true,
      notification_created: userPref[`${type}_inapp`] !== false,
      email_sent: send_email && userPref[`${type}_email`] !== false
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});