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

    console.log('🔍 Checking booking availability for:', targetUserEmail);

    // Get user details from Microsoft Graph to get their principal name
    const userDetailsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}`,
      {
        headers: {
          'Authorization': ssoAuthorization,
          'Content-Type': 'application/json'
        }
      }
    );

    let targetUserPrincipalName = targetUserEmail;
    let targetDisplayName = '';
    
    if (userDetailsResponse.ok) {
      const userData = await userDetailsResponse.json();
      targetUserPrincipalName = userData.userPrincipalName || targetUserEmail;
      targetDisplayName = userData.displayName || '';
      console.log('✅ User found:', targetDisplayName, targetUserPrincipalName);
    }

    // Get all booking businesses
    const businessesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/solutions/bookingBusinesses',
      {
        headers: {
          'Authorization': ssoAuthorization,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!businessesResponse.ok) {
      const errorText = await businessesResponse.text();
      console.error('❌ Bookings API error:', errorText);
      return Response.json({
        success: true,
        hasBookings: false,
        bookingBusiness: null,
        userEmail: targetUserEmail
      });
    }

    const businessesData = await businessesResponse.json();
    const businesses = businessesData.value || [];
    console.log(`📊 Found ${businesses.length} booking businesses`);

    // Check each business for the target user
    for (const business of businesses) {
      console.log(`🔍 Checking business: ${business.displayName || business.id}`);
      
      // Check if business name matches user
      const businessNameLower = (business.displayName || '').toLowerCase();
      const displayNameLower = targetDisplayName.toLowerCase();
      
      if (displayNameLower && businessNameLower.includes(displayNameLower)) {
        console.log('✅ Found matching business by name!');
        return Response.json({
          success: true,
          hasBookings: true,
          bookingBusiness: business,
          userEmail: targetUserEmail
        });
      }

      // Check staff members
      try {
        const staffResponse = await fetch(
          `https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${business.id}/staffMembers`,
          {
            headers: {
              'Authorization': ssoAuthorization,
              'Content-Type': 'application/json'
            }
          }
        );

        if (staffResponse.ok) {
          const staffData = await staffResponse.json();
          const staff = staffData.value || [];
          console.log(`📋 Found ${staff.length} staff members in ${business.displayName}`);
          
          // Check multiple email fields and user principal name
          const isStaffMember = staff.some(member => {
            const memberEmail = (member.emailAddress || '').toLowerCase();
            const memberUpn = (member.userPrincipalName || '').toLowerCase();
            const targetEmailLower = targetUserEmail.toLowerCase();
            const targetUpnLower = targetUserPrincipalName.toLowerCase();
            
            return memberEmail === targetEmailLower || 
                   memberUpn === targetUpnLower ||
                   memberEmail === targetUpnLower ||
                   memberUpn === targetEmailLower;
          });

          if (isStaffMember) {
            console.log('✅ Found user as staff member!');
            return Response.json({
              success: true,
              hasBookings: true,
              bookingBusiness: business,
              userEmail: targetUserEmail
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error checking staff for business ${business.id}:`, error);
        continue;
      }
    }

    console.log('❌ No booking business found for user');
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