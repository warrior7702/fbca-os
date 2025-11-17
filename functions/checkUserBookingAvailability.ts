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

    // Get all booking businesses the user has access to
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
      console.error('Bookings API error:', errorText);
      return Response.json({
        success: true,
        hasBookings: false,
        bookingBusiness: null,
        userEmail: targetUserEmail
      });
    }

    const businessesData = await businessesResponse.json();
    const businesses = businessesData.value || [];

    // For each business, check if the target user is a staff member
    for (const business of businesses) {
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
          
          // Check if target user is in the staff list
          const isStaffMember = staff.some(member => 
            member.emailAddress?.toLowerCase() === targetUserEmail.toLowerCase()
          );

          if (isStaffMember) {
            return Response.json({
              success: true,
              hasBookings: true,
              bookingBusiness: business,
              userEmail: targetUserEmail
            });
          }
        }
      } catch (error) {
        console.error(`Error checking staff for business ${business.id}:`, error);
        continue;
      }
    }

    // No booking business found for this user
    return Response.json({
      success: true,
      hasBookings: false,
      bookingBusiness: null,
      userEmail: targetUserEmail
    });

  } catch (error) {
    console.error('Check booking availability error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});