import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    if (!me) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🔍 INVESTIGATING: What IS 3566727?');

    const report = {
      timestamp: new Date().toISOString(),
      mystery_id: '3566727',
      investigations: []
    };

    // Get user's token
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user = users[0];
    
    if (!user?.pco_access_token) {
      return Response.json({ error: 'No PCO token' }, { status: 400 });
    }

    const token = user.pco_access_token;

    // INVESTIGATION 1: Check if 3566727 is an OAuth application
    console.log('📋 1. Checking if 3566727 is an OAuth application...');
    try {
      const appRes = await fetch('https://api.planningcenteronline.com/oauth/applications/3566727', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (appRes.ok) {
        const appData = await appRes.json();
        report.investigations.push({
          test: 'OAuth Application Check',
          result: 'FOUND',
          data: appData,
          conclusion: '3566727 IS an OAuth application!'
        });
        console.log('✅ 3566727 IS an OAuth application!');
      } else {
        report.investigations.push({
          test: 'OAuth Application Check',
          result: 'NOT FOUND',
          status: appRes.status
        });
        console.log('❌ 3566727 is NOT an OAuth application');
      }
    } catch (error) {
      report.investigations.push({
        test: 'OAuth Application Check',
        result: 'ERROR',
        error: error.message
      });
    }

    // INVESTIGATION 2: Check environment variables
    console.log('📋 2. Checking environment OAuth credentials...');
    const pcoClientId = Deno.env.get('PCO_CLIENT_ID');
    const pcoAppId2 = Deno.env.get('PCO_APP_ID2');
    
    report.investigations.push({
      test: 'Environment Variables',
      PCO_CLIENT_ID: pcoClientId,
      PCO_APP_ID2: pcoAppId2,
      matches_mystery_id: pcoClientId === '3566727' || pcoAppId2 === '3566727'
    });

    // INVESTIGATION 3: Token introspection with BOTH OAuth apps
    console.log('📋 3. Token introspection with PCO_CLIENT_ID...');
    try {
      const clientId = pcoClientId;
      const clientSecret = Deno.env.get('PCO_CLIENT_SECRET');
      
      if (clientId && clientSecret) {
        const introspectRes = await fetch('https://api.planningcenteronline.com/oauth/introspect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
          },
          body: `token=${token}`
        });
        
        if (introspectRes.ok) {
          const data = await introspectRes.json();
          report.investigations.push({
            test: 'Token Introspection (PCO_CLIENT_ID)',
            result: data,
            token_belongs_to_app: data.client_id === clientId,
            resource_owner_id: data.resource_owner_id || 'NOT PRESENT'
          });
          console.log('✅ Introspection data:', JSON.stringify(data, null, 2));
        }
      }
    } catch (error) {
      report.investigations.push({
        test: 'Token Introspection (PCO_CLIENT_ID)',
        result: 'ERROR',
        error: error.message
      });
    }

    // INVESTIGATION 4: Check if PCO_APP_ID2 contains 3566727
    console.log('📋 4. Checking if 3566727 is in OLD OAuth app (PCO_APP_ID2)...');
    if (pcoAppId2) {
      report.investigations.push({
        test: 'Old OAuth App Check',
        PCO_APP_ID2_value: pcoAppId2,
        contains_3566727: pcoAppId2.includes('3566727'),
        exact_match: pcoAppId2 === '3566727'
      });
    }

    // INVESTIGATION 5: Try to get OAuth token info
    console.log('📋 5. Getting OAuth token info...');
    try {
      const tokenInfoRes = await fetch('https://api.planningcenteronline.com/oauth/token/info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (tokenInfoRes.ok) {
        const tokenInfo = await tokenInfoRes.json();
        report.investigations.push({
          test: 'OAuth Token Info',
          result: tokenInfo,
          application_id: tokenInfo.data?.relationships?.application?.data?.id
        });
        console.log('✅ Token info:', JSON.stringify(tokenInfo, null, 2));
      }
    } catch (error) {
      report.investigations.push({
        test: 'OAuth Token Info',
        result: 'ERROR',
        error: error.message
      });
    }

    // INVESTIGATION 6: Check stored pco_user_id
    console.log('📋 6. Checking stored pco_user_id in database...');
    report.investigations.push({
      test: 'Stored PCO User ID',
      stored_id: user.pco_user_id || null,
      matches_3566727: user.pco_user_id === '3566727'
    });

    // FINAL ANALYSIS
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    
    report.conclusion = {
      likely_cause: 'Unknown - see investigation results',
      action_needed: 'Review investigation results to determine nature of 3566727'
    };

    // Check if we found that 3566727 is the OAuth app itself
    const appCheck = report.investigations.find(i => i.test === 'OAuth Application Check');
    if (appCheck?.result === 'FOUND') {
      report.conclusion = {
        likely_cause: '3566727 is an OAuth APPLICATION, not a user!',
        action_needed: 'The OAuth app itself has ID 3566727. Your token may be from the wrong OAuth app.'
      };
    }

    console.log('Conclusion:', report.conclusion);

    return Response.json({
      ok: true,
      report: report
    });

  } catch (error) {
    console.error('❌ Investigation error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});