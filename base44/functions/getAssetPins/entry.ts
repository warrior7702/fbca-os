import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { levelId } = await req.json();

    if (!levelId) {
      return Response.json({ 
        error: 'Missing required field: levelId' 
      }, { status: 400 });
    }

    const pins = await base44.entities.AkitaPin.filter({
      level_id: levelId
    });

    return Response.json({
      success: true,
      pins
    });

  } catch (error) {
    console.error('Error getting asset pins:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});