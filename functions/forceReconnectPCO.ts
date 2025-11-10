import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    if (!me) {
      return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🔄 FORCE RECONNECT - Wiping all PCO tokens for:', me.email);

    // COMPLETELY wipe all PCO data from user
    await base44.auth.updateMe({
      pco_access_token: null,
      pco_refresh_token: null,
      pco_token_expires_at: null,
      pco_user_id: null
    });

    console.log('✅ All PCO tokens wiped clean!');

    // Get environment variables
    const clientId = Deno.env.get('PCO_CLIENT_ID');
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://fbca-os.base44.app';
    
    if (!clientId) {
      return Response.json({ 
        ok: false, 
        error: 'Missing PCO_CLIENT_ID' 
      }, { status: 500 });
    }

    // Build redirect URI - MUST match what's configured in PCO OAuth app
    const redirectUri = `${appUrl}/api/function/pcoCallback`;
    
    console.log('📋 Using PCO_CLIENT_ID:', clientId);
    console.log('🔗 Redirect URI:', redirectUri);

    // Build OAuth URL
    const authUrl = `https://api.planningcenteronline.com/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=calendar people` +
      `&state=${encodeURIComponent(me.id)}`;

    console.log('✅ Generated fresh OAuth URL');

    return Response.json({
      ok: true,
      message: 'All PCO tokens wiped. Redirect to fresh OAuth flow.',
      auth_url: authUrl,
      debug: {
        client_id: clientId,
        redirect_uri: redirectUri,
        app_url: appUrl
      }
    });

  } catch (error) {
    console.error('❌ Force reconnect error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});