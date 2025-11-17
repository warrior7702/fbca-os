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

    console.log('🔍 Checking Book with Me availability for:', targetUserEmail);

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
      console.error('❌ User not found in Microsoft 365');
      return Response.json({
        success: true,
        hasBookings: false,
        bookingBusiness: null,
        userEmail: targetUserEmail
      });
    }

    const userData = await userDetailsResponse.json();
    console.log('✅ User found:', userData.displayName);

    // Check if user has a mailbox (required for Book with Me)
    const mailboxResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`,
      {
        headers: {
          'Authorization': ssoAuthorization,
          'Content-Type': 'application/json'
        }
      }
    );

    if (mailboxResponse.ok) {
      console.log('✅ User has Book with Me capability');
      // User has a mailbox, so they can use Book with Me
      return Response.json({
        success: true,
        hasBookings: true,
        bookingType: 'bookwithme',
        bookingBusiness: {
          id: userData.id,
          displayName: userData.displayName,
          email: userData.mail || userData.userPrincipalName,
          bookWithMeUrl: `https://outlook.office.com/bookwithme/user/${encodeURIComponent(userData.userPrincipalName || targetUserEmail)}?anonymous&ismsaljsauthenabled`
        },
        userEmail: targetUserEmail
      });
    }

    console.log('❌ User does not have Book with Me capability');
    return Response.json({
      success: true,
      hasBookings: false,
      bookingBusiness: null,
      userEmail: targetUserEmail
    });

  } catch (error) {
    console.error('❌ Check booking availability error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});