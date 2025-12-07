import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, levelId, x, y, documentId } = await req.json();

    if (!assetId || !levelId || x === undefined || y === undefined) {
      return Response.json({ 
        error: 'Missing required fields: assetId, levelId, x, y' 
      }, { status: 400 });
    }

    // Check if pin already exists
    const existingPins = await base44.entities.AkitaPin.filter({
      asset_id: assetId,
      level_id: levelId
    });

    const pinData = {
      asset_id: assetId,
      level_id: levelId,
      document_id: documentId || null,
      x,
      y,
      updated_by: user.id
    };

    let result;
    if (existingPins.length > 0) {
      result = await base44.entities.AkitaPin.update(existingPins[0].id, pinData);
    } else {
      result = await base44.entities.AkitaPin.create(pinData);
    }

    return Response.json({
      success: true,
      pin: result
    });

  } catch (error) {
    console.error('Error updating asset pin:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});