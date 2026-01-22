import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.pco_access_token) {
      return Response.json({ error: 'PCO not connected' }, { status: 401 });
    }

    // Get PCO user ID
    const meUrl = 'https://api.planningcenteronline.com/people/v2/me';
    const meResponse = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
    });

    if (!meResponse.ok) {
      throw new Error(`Failed to get PCO user: ${meResponse.status}`);
    }

    const meData = await meResponse.json();
    const pcoUserId = meData.data.id;

    // Get approval groups for this user
    const groupsUrl = `https://api.planningcenteronline.com/calendar/v2/people/${pcoUserId}/resource_approval_groups?per_page=100`;
    const groupsResponse = await fetch(groupsUrl, {
      headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
    });

    if (!groupsResponse.ok) {
      throw new Error(`Failed to get approval groups: ${groupsResponse.status}`);
    }

    const groupsData = await groupsResponse.json();
    const approvalGroupNames = groupsData.data.map(g => g.attributes.name);

    console.log(`✅ User ${user.email} has ${approvalGroupNames.length} approval groups`);

    return Response.json({
      success: true,
      approvalGroupNames: approvalGroupNames,
      count: approvalGroupNames.length
    });

  } catch (error) {
    console.error('❌ Error fetching user groups:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});