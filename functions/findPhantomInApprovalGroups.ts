import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    if (!me) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🔍 SEARCHING APPROVAL GROUPS FOR 3566727');

    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json({ error: 'No PCO token' }, { status: 400 });
    }

    const token = user.pco_access_token;

    const report = {
      timestamp: new Date().toISOString(),
      phantom_id: '3566727',
      your_id: '149670080',
      groups_with_phantom: [],
      groups_with_you: [],
      groups_with_both: []
    };

    // Get all approval groups
    console.log('📋 Fetching all approval groups...');
    const groupsRes = await fetch('https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!groupsRes.ok) {
      return Response.json({ error: 'Failed to fetch approval groups' }, { status: 500 });
    }

    const groupsData = await groupsRes.json();
    const groups = groupsData.data || [];

    console.log(`Found ${groups.length} approval groups`);

    // Check each group for phantom user
    for (const group of groups) {
      console.log(`\n📁 Checking group: ${group.attributes?.name} (${group.id})`);
      
      const peopleRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!peopleRes.ok) {
        console.log('  ❌ Failed to fetch people for this group');
        continue;
      }

      const peopleData = await peopleRes.json();
      const people = peopleData.data || [];

      console.log(`  Found ${people.length} people in group`);

      const hasPhantom = people.some(p => p.id === '3566727');
      const hasYou = people.some(p => p.id === '149670080');

      if (hasPhantom || hasYou) {
        const groupInfo = {
          id: group.id,
          name: group.attributes?.name,
          people: people.map(p => ({
            id: p.id,
            name: p.attributes?.name,
            email: p.attributes?.email
          }))
        };

        if (hasPhantom && hasYou) {
          console.log('  🚨 BOTH phantom AND you found!');
          report.groups_with_both.push(groupInfo);
        } else if (hasPhantom) {
          console.log('  ⚠️ PHANTOM found (but not you)');
          report.groups_with_phantom.push(groupInfo);
        } else if (hasYou) {
          console.log('  ✅ You found (no phantom)');
          report.groups_with_you.push(groupInfo);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 SEARCH COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Groups with phantom only: ${report.groups_with_phantom.length}`);
    console.log(`Groups with you only: ${report.groups_with_you.length}`);
    console.log(`Groups with BOTH: ${report.groups_with_both.length}`);

    // Generate conclusion
    if (report.groups_with_phantom.length > 0 || report.groups_with_both.length > 0) {
      report.verdict = {
        found: true,
        message: `Found user 3566727 in ${report.groups_with_phantom.length + report.groups_with_both.length} approval group(s)!`,
        action: 'Remove user 3566727 from these approval groups in PCO Calendar settings.'
      };
    } else {
      report.verdict = {
        found: false,
        message: 'User 3566727 NOT found in any approval groups',
        action: 'The phantom user must be somewhere else. Check resource ownership or event permissions.'
      };
    }

    return Response.json({
      ok: true,
      report: report
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});