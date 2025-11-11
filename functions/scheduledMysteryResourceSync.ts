import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (cronSecret && providedSecret !== cronSecret) {
      console.error('❌ Invalid cron secret');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⏰ Scheduled Mystery Resource sync started...');
    
    const base44 = createClientFromRequest(req);
    
    // Get all users with PCO access
    const users = await base44.asServiceRole.entities.User.filter({
      pco_access_token: { $exists: true, $ne: null }
    });

    console.log(`👥 Found ${users.length} users with PCO access`);

    if (users.length === 0) {
      console.log('⚠️ No users with PCO access found');
      return Response.json({
        success: true,
        message: 'No users with PCO access',
        synced: 0
      });
    }

    // Use first admin user or any user with PCO access
    const syncUser = users.find(u => u.role === 'admin') || users[0];
    console.log(`🔄 Syncing with user: ${syncUser.email}`);

    // Call monitorMysteryResource function
    const functionUrl = `${Deno.env.get('BASE44_APP_URL')}/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/monitorMysteryResource`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncUser.pco_access_token}`
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Sync completed successfully');
      console.log(`   New requests created: ${result.new_requests_created}`);
      console.log(`   Emails sent: ${result.emails_sent}`);
      
      return Response.json({
        success: true,
        sync_result: result,
        synced_by: syncUser.email
      });
    } else {
      console.error('❌ Sync failed:', result);
      return Response.json({
        success: false,
        error: result.error || 'Sync failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Scheduled sync error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});