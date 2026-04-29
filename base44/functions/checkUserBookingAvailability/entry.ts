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
      const errorText = await userDetailsResponse.text();
      console.error('❌ User not found in Microsoft 365:', errorText);
      return Response.json({
        success: true,
        hasBookings: false,
        bookingBusiness: null,
        userEmail: targetUserEmail,
        debug: { error: 'User not found', details: errorText }
      });
    }

    const userData = await userDetailsResponse.json();
    console.log('✅ User found:', userData.displayName, userData.userPrincipalName);
    console.log('📧 User details:', {
      id: userData.id,
      mail: userData.mail,
      userPrincipalName: userData.userPrincipalName
    });

    // Every Microsoft 365 user with a mailbox has Book with Me capability
    // We just need to verify they exist and construct the URL
    const bookWithMeUrl = `https://outlook.office.com/bookwithme/user/${encodeURIComponent(userData.userPrincipalName || targetUserEmail)}?anonymous&ismsaljsauthenabled`;

    console.log('✅ User has Book with Me capability');
    console.log('🔗 Book with Me URL:', bookWithMeUrl);

    return Response.json({
      success: true,
      hasBookings: true,
      bookingType: 'bookwithme',
      bookingBusiness: {
        id: userData.id,
        displayName: userData.displayName,
        email: userData.mail || userData.userPrincipalName,
        userPrincipalName: userData.userPrincipalName,
        bookWithMeUrl: bookWithMeUrl
      },
      userEmail: targetUserEmail,
      debug: {
        userData: userData
      }
    });

  } catch (error) {
    console.error('❌ Check booking availability error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});