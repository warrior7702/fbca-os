import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication - any authenticated user can import
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const { cardholders } = await req.json();

    if (!Array.isArray(cardholders) || cardholders.length === 0) {
      return Response.json({ 
        error: 'cardholders array required',
        example: { cardholders: [{ name: "John Doe", pin: "123456", member_id: "M123", email: "john@example.com" }] }
      }, { status: 400 });
    }

    console.log(`📥 Importing ${cardholders.length} cardholders...`);

    // Validate all records first
    const validated = cardholders.map((c, idx) => {
      if (!c.name || !c.pin) {
        throw new Error(`Record ${idx}: name and pin required`);
      }
      return {
        name: c.name.trim(),
        pin: String(c.pin).trim(),
        member_id: c.member_id ? String(c.member_id).trim() : null,
        email: c.email ? String(c.email).trim().toLowerCase() : null
      };
    });

    // Bulk create using service role (admin permissions)
    const results = await base44.asServiceRole.entities.Cardholder.bulkCreate(validated);

    console.log(`✅ Successfully imported ${results.length} cardholders`);

    return Response.json({
      ok: true,
      imported: results.length,
      message: `Successfully imported ${results.length} cardholders`
    });

  } catch (error) {
    console.error('❌ Import error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});