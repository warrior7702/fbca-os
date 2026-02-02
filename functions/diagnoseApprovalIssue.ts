import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    console.log('🔍 Starting approval diagnostics...');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('👤 Currently logged in as:', user?.email, 'Base44 ID:', user?.id);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resourceRequestId, eventId } = body;

    // Step 1: Get the stored token
    console.log('📦 Step 1: Fetching stored token from Base44...');
    const userRecord = await base44.asServiceRole.entities.User.get(user.id);
    console.log('✅ Found token in DB, user.pco_access_token exists:', !!userRecord?.pco_access_token);
    console.log('✅ Token expiry:', userRecord?.pco_token_expires_at);

    if (!userRecord?.pco_access_token) {
      return Response.json({ error: 'No PCO token stored' }, { status: 400 });
    }

    // Step 2: Verify the token
    console.log('📦 Step 2: Calling /me with stored token...');
    const meResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/me',
      {
        headers: { 'Authorization': `Bearer ${userRecord.pco_access_token}` }
      }
    );
    const meData = await meResponse.json();
    const pcoUserId = meData.data?.id;
    const pcoUserName = meData.data?.attributes?.name;
    console.log('✅ /me returned PCO user:', pcoUserName, '(ID:', pcoUserId, ')');

    // Step 3: Try the PATCH request
    console.log('📦 Step 3: Attempting PATCH to approve resource request...');
    const pcoUrl = `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests/${resourceRequestId}`;
    console.log('   URL:', pcoUrl);
    console.log('   Token last 20 chars:', userRecord.pco_access_token.slice(-20));

    const patchResponse = await fetch(pcoUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userRecord.pco_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          type: 'EventResourceRequest',
          id: resourceRequestId.toString(),
          attributes: {
            approval_status: 'A'
          }
        }
      })
    });

    const patchData = await patchResponse.json();
    console.log('📬 PATCH response status:', patchResponse.status);
    console.log('📬 PATCH response body:', JSON.stringify(patchData));

    // Step 4: Get user's approval groups
    console.log('📦 Step 4: Checking approval groups...');
    const groupsResponse = await fetch(
      'https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100',
      { headers: { 'Authorization': `Bearer ${userRecord.pco_access_token}` } }
    );
    const groupsData = await groupsResponse.json();
    
    let myGroups = [];
    for (const group of (groupsData.data || [])) {
      const membersResponse = await fetch(
        `https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`,
        { headers: { 'Authorization': `Bearer ${userRecord.pco_access_token}` } }
      );
      
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        const isMember = (membersData.data || []).some(person => person.id === pcoUserId);
        
        if (isMember) {
          myGroups.push({
            id: group.id,
            name: group.attributes?.name
          });
          console.log('✅ Member of:', group.attributes?.name);
        }
      }
    }

    // Step 5: Check the specific request details
    console.log('📦 Step 5: Fetching request details...');
    const requestResponse = await fetch(
      `https://api.planningcenteronline.com/calendar/v2/events/${eventId}/event_resource_requests/${resourceRequestId}?include=resource`,
      { headers: { 'Authorization': `Bearer ${userRecord.pco_access_token}` } }
    );
    const requestData = await requestResponse.json();
    console.log('📋 Request details:', JSON.stringify(requestData, null, 2));

    return Response.json({
      success: false,
      diagnosis: {
        base44_user: {
          email: user.email,
          id: user.id
        },
        pco_user: {
          name: pcoUserName,
          id: pcoUserId
        },
        token_info: {
          stored: true,
          expires_at: userRecord?.pco_token_expires_at,
          last_20_chars: userRecord.pco_access_token.slice(-20)
        },
        approval_groups: myGroups,
        patch_attempt: {
          status: patchResponse.status,
          error: patchData.errors?.[0]?.detail || 'No error detail',
          user_id_in_error: patchData.errors?.[0]?.meta?.description || 'No user ID in error'
        },
        request_details: requestData.data || null
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});