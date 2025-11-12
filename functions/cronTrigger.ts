import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * This is a simple HTTP endpoint that Vercel Cron can call
 * It then triggers the actual scheduledMysteryResourceSync function
 */
Deno.serve(async (req) => {
  try {
    console.log('🔔 Cron trigger received from Vercel');
    
    const base44 = createClientFromRequest(req);
    
    // Verify this is from Vercel Cron
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    
    // Vercel sends Authorization: Bearer <CRON_SECRET>
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Invalid cron authorization');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ Authorization valid, calling scheduledMysteryResourceSync...');
    
    // Call the actual sync function using Base44 SDK
    const result = await base44.asServiceRole.functions.invoke('scheduledMysteryResourceSync');
    
    console.log('✅ Sync function completed:', result);
    
    return Response.json({
      success: true,
      message: 'Cron triggered successfully',
      result: result.data
    });
    
  } catch (error) {
    console.error('❌ Cron trigger error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});