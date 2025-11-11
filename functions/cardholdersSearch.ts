import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const buildingKeywords = {
  'pcb': ['pcb', 'preschool', 'pre-school', 'preschool building'],
  'fbc': ['fbc', 'main', 'main building', 'first baptist'],
  'wade': ['wade', 'wade center', 'wade building'],
  'sb': ['sb', 'student building', 'student center', 'sc'],
  'sc': ['sc', 'student building', 'student center', 'sb'],
  'unlock': ['unlock', 'building access', 'door', 'access']
};

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

function matchesBuilding(query, record) {
  const qn = normalize(query);
  const name = normalize(record.name);
  const email = normalize(record.email);
  const memberId = normalize(record.member_id);
  
  for (const [building, keywords] of Object.entries(buildingKeywords)) {
    if (keywords.some(k => qn.includes(k) || k.includes(qn))) {
      if (name.includes(building) || email.includes(building) || memberId.includes(building)) {
        return true;
      }
    }
  }
  
  return false;
}

function score(q, record) {
  const qn = normalize(q);
  const name = normalize(record.name);
  const pin = normalize(record.pin);
  const email = normalize(record.email);
  const memberId = normalize(record.member_id);
  
  if (!qn) return 0;
  
  // Exact PIN match = highest priority
  if (pin === qn) return 200;
  
  // PIN starts with query
  if (pin.startsWith(qn)) return 150;
  
  // Exact name match
  if (name === qn) return 140;
  
  // Name starts with query
  if (name.startsWith(qn)) return 100;
  
  // Building keyword match
  if (matchesBuilding(q, record)) return 90;
  
  // Email starts with query
  if (email && email.startsWith(qn)) return 80;
  
  // Member ID starts with query
  if (memberId && memberId.startsWith(qn)) return 70;
  
  // Name contains query
  if (name.includes(qn)) return 50;
  
  // PIN contains query
  if (pin.includes(qn)) return 40;
  
  // Email contains query
  if (email && email.includes(qn)) return 30;
  
  // Member ID contains query
  if (memberId && memberId.includes(qn)) return 20;
  
  return 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Support both POST body and URL params
    let q = '';
    let limit = 12;
    
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      q = body.q || body.query || '';
      limit = parseInt(body.limit || '12', 10);
    } else {
      // GET request - read from URL params
      const url = new URL(req.url);
      q = url.searchParams.get('q') || url.searchParams.get('query') || '';
      limit = parseInt(url.searchParams.get('limit') || '12', 10);
    }

    console.log(`🔍 Searching for: "${q}" (method: ${req.method})`);

    // Get all cardholders
    const cardholders = await base44.asServiceRole.entities.Cardholder.list();
    console.log(`📊 Total cardholders: ${cardholders.length}`);

    if (!cardholders || cardholders.length === 0) {
      return Response.json({ 
        ok: true, 
        results: [],
        debug: { total: 0, query: q }
      });
    }

    // Score and filter results
    const results = cardholders
      .map(r => ({ r, s: score(q, r) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.r);

    console.log(`✅ Found ${results.length} matching results`);

    return Response.json({ 
      ok: true, 
      results,
      debug: { 
        total: cardholders.length, 
        query: q, 
        matched: results.length 
      }
    }, {
      headers: { 
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ cardholdersSearch error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message,
      results: []
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});