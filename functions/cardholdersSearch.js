import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

function score(q, record) {
  const qn = normalize(q);
  const name = normalize(record.name);
  const pin = normalize(record.pin);
  
  if (!qn) return 0;
  if (name.startsWith(qn) || pin.startsWith(qn)) return 100;
  if (name.includes(qn) || pin.includes(qn)) return 50;
  return 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);

    // Get all cardholders
    const cardholders = await base44.asServiceRole.entities.Cardholder.list();

    // Score and filter results
    const results = cardholders
      .map(r => ({ r, s: score(q, r) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.r);

    return Response.json({ 
      ok: true, 
      results 
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('cardholdersSearch error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});