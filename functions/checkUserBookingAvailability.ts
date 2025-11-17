import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ssoAuthorization = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!ssoAuthorization) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail required' }, { status: 400 });
    }

    console.log('🔍 Checking availability for:', targetUserEmail);

    // Get user details from Microsoft Graph
    const userDetailsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}`,
      {
        headers: {
          'Authorization': ssoAuthorization,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!userDetailsResponse.ok) {
      const errorText = await userDetailsResponse.text();
      console.error('❌ User not found:', errorText);
      return Response.json({
        success: true,
        hasBookings: false,
        userEmail: targetUserEmail,
        debug: { error: 'User not found', details: errorText }
      });
    }

    const userData = await userDetailsResponse.json();
    console.log('✅ User found:', userData.displayName);
    console.log('📧 Email:', userData.mail);
    console.log('📧 UPN:', userData.userPrincipalName);

    // Every M365 user can accept meeting requests
    // Return their details so we can send them a meeting request
    return Response.json({
      success: true,
      hasBookings: true,
      bookingType: 'meeting-request',
      userDetails: {
        id: userData.id,
        displayName: userData.displayName,
        mail: userData.mail,
        userPrincipalName: userData.userPrincipalName
      },
      userEmail: targetUserEmail
    });

  } catch (error) {
    console.error('❌ Check availability error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});