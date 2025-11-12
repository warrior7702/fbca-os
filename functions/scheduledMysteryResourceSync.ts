import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const startTime = Date.now();
  const base44 = createClientFromRequest(req);
  
  // Log execution start
  let logId = null;
  try {
    const startLog = await base44.asServiceRole.entities.CronExecutionLog.create({
      function_name: 'scheduledMysteryResourceSync',
      status: 'started',
      trigger_source: req.headers.get('user-agent') || 'unknown'
    });
    logId = startLog.id;
    console.log('📝 Created execution log:', logId);
  } catch (logError) {
    console.error('⚠️ Failed to create start log:', logError);
  }

  try {
    // Auth check: Accept EITHER cron secret OR valid user authentication
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    
    let isAuthorized = false;
    let triggerType = 'unknown';
    
    // Check if this is a cron call (has CRON_SECRET)
    if (cronSecret && providedSecret === cronSecret) {
      isAuthorized = true;
      triggerType = 'cron-secret';
      console.log('✅ Authorized via CRON_SECRET');
    }
    // Check if this is a cron call via Authorization header (Vercel style)
    else if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
      triggerType = 'cron-bearer';
      console.log('✅ Authorized via Bearer CRON_SECRET');
    }
    // Check if this is a manual call with valid user authentication
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const user = await base44.auth.me();
        if (user) {
          isAuthorized = true;
          triggerType = `manual-user:${user.email}`;
          console.log('✅ Authorized via user authentication:', user.email);
        }
      } catch (authError) {
        console.error('❌ User authentication failed:', authError.message);
      }
    }
    
    if (!isAuthorized) {
      console.error('❌ Unauthorized: No valid cron secret or user authentication');
      
      if (logId) {
        await base44.asServiceRole.entities.CronExecutionLog.update(logId, {
          status: 'failed',
          error_message: 'Unauthorized - Invalid cron secret or user authentication',
          execution_time_ms: Date.now() - startTime
        });
      }
      
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⏰ Scheduled Mystery Resource sync started...');
    console.log('🔍 Triggered by:', triggerType);
    console.log('🔍 User agent:', req.headers.get('user-agent') || 'unknown');
    
    // Get all users with PCO access
    const users = await base44.asServiceRole.entities.User.filter({
      pco_access_token: { $exists: true, $ne: null }
    });

    console.log(`👥 Found ${users.length} users with PCO access`);

    if (users.length === 0) {
      console.log('⚠️ No users with PCO access found');
      
      if (logId) {
        await base44.asServiceRole.entities.CronExecutionLog.update(logId, {
          status: 'success',
          trigger_source: triggerType,
          synced_by_email: 'none',
          events_checked: 0,
          mystery_resources_found: 0,
          new_requests_created: 0,
          emails_sent: 0,
          execution_time_ms: Date.now() - startTime,
          result_details: { message: 'No users with PCO access' }
        });
      }
      
      return Response.json({
        success: true,
        message: 'No users with PCO access',
        synced: 0
      });
    }

    // Use first admin user or any user with PCO access
    const syncUser = users.find(u => u.role === 'admin') || users[0];
    console.log(`🔄 Syncing with user: ${syncUser.email}`);

    // Call monitorMysteryResource function directly
    console.log('📞 Calling monitorMysteryResource function...');
    
    const functionUrl = `${Deno.env.get('BASE44_APP_URL')}/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/monitorMysteryResource`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '' // Pass through auth
      }
    });

    // Handle non-JSON responses (like deployment pages)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function call failed (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Sync completed successfully');
      console.log(`   New requests created: ${result.new_requests_created}`);
      console.log(`   Emails sent: ${result.emails_sent}`);
      
      // Update log with success
      if (logId) {
        await base44.asServiceRole.entities.CronExecutionLog.update(logId, {
          status: 'success',
          trigger_source: triggerType,
          synced_by_email: syncUser.email,
          events_checked: result.events_checked || 0,
          mystery_resources_found: result.found || 0,
          new_requests_created: result.new_requests_created || 0,
          emails_sent: result.emails_sent || 0,
          execution_time_ms: Date.now() - startTime,
          result_details: result
        });
      }
      
      return Response.json({
        success: true,
        sync_result: result,
        synced_by: syncUser.email,
        timestamp: new Date().toISOString(),
        log_id: logId,
        triggered_by: triggerType
      });
    } else {
      console.error('❌ Sync failed:', result);
      
      // Update log with failure
      if (logId) {
        await base44.asServiceRole.entities.CronExecutionLog.update(logId, {
          status: 'failed',
          trigger_source: triggerType,
          synced_by_email: syncUser.email,
          error_message: result.error || 'Sync failed',
          execution_time_ms: Date.now() - startTime,
          result_details: result
        });
      }
      
      return Response.json({
        success: false,
        error: result.error || 'Sync failed',
        details: result
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Scheduled sync error:', error);
    console.error('Stack:', error.stack);
    
    // Update log with error
    if (logId) {
      try {
        await base44.asServiceRole.entities.CronExecutionLog.update(logId, {
          status: 'failed',
          error_message: error.message,
          error_stack: error.stack,
          execution_time_ms: Date.now() - startTime
        });
      } catch (updateError) {
        console.error('⚠️ Failed to update error log:', updateError);
      }
    }
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      log_id: logId
    }, { status: 500 });
  }
});