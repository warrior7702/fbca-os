import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { days_ahead = 21 } = await req.json().catch(() => ({}));

    console.log('🔄 Starting Event Ops sync from PCO...');

    // STEP 1: Fetch upcoming events with approvals
    console.log('📝 Step 1: Fetching events...');
    const fetchResponse = await base44.asServiceRole.functions.invoke(
      'pcoFetchUpcomingApprovalEvents',
      { days_ahead }
    );

    if (!fetchResponse.data?.success) {
      throw new Error(fetchResponse.data?.error || 'Failed to fetch events');
    }

    const events = fetchResponse.data.events || [];
    console.log(`✅ Fetched ${events.length} events`);

    // STEP 2: Upsert data into entities
    console.log('📝 Step 2: Upserting data...');
    const upsertResponse = await base44.asServiceRole.functions.invoke(
      'pcoUpsertEventOpsData',
      { events }
    );

    if (!upsertResponse.data?.success) {
      throw new Error(upsertResponse.data?.error || 'Failed to upsert data');
    }

    const results = upsertResponse.data.results;
    console.log(`✅ Sync complete:`, results);

    return Response.json({
      success: true,
      events_upserted: results.events_upserted,
      rooms_upserted: results.rooms_upserted,
      approvals_upserted: results.approvals_upserted,
      errors: results.errors || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in syncEventOpsFromPCO:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});