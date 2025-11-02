// approveResourceRequest.js  (Base44 Deno runtime)
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const PCO = {
  base: 'https://api.planningcenteronline.com/calendar/v2'
};

async function pcoGet(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GET ${url} :: ${r.status} :: ${JSON.stringify(j)}`);
  return j;
}

async function pcoPost(url, token, body = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`POST ${url} :: ${r.status} :: ${text}`);
  return text ? JSON.parse(text).catch(() => ({})) : { ok: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    // ---- 0) parse payload safely (support JSON or form POST) ----
    let body = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { body = await req.json(); } catch { body = {}; }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }
    const request_id = String(body.request_id || '').trim();
    const action = String(body.action || '').trim().toLowerCase(); // 'approve' | 'deny'
    const note = body.note ? String(body.note) : undefined;

    if (!request_id || !['approve', 'deny'].includes(action)) {
      return Response.json(
        { ok: false, error: 'request_id and action=approve|deny required' },
        { status: 400 }
      );
    }

    // ---- 1) require a user token; don't use the service token for writes ----
    const userToken = me?.pco_access_token;
    const personId = me?.pco_user_id; // e.g. "149670080"
    if (!userToken || !personId) {
      return Response.json(
        { ok: false, error: 'No user PCO token; user must connect PCO first.' },
        { status: 401 }
      );
    }

    console.log('🔍 Approving as person ID:', personId);

    // ---- 2) Get all approval groups and check membership ----
    const groupsResponse = await pcoGet(
      `${PCO.base}/resource_approval_groups?per_page=100`,
      userToken
    );

    const myGroupIds = [];
    for (const group of groupsResponse.data || []) {
      // Get members of this group
      const membersResponse = await pcoGet(
        `${PCO.base}/resource_approval_groups/${group.id}/people?per_page=100`,
        userToken
      );
      
      // Check if I'm in this group
      const isMember = (membersResponse.data || []).some(person => person.id === personId);
      if (isMember) {
        myGroupIds.push(group.id);
        console.log('✅ Member of group:', group.attributes?.name, '(', group.id, ')');
      }
    }

    console.log('📋 My group IDs:', myGroupIds);

    // ---- 3) pull bookings for this request; approval group lives here ----
    const bookings = await pcoGet(
      `${PCO.base}/event_resource_requests/${request_id}/resource_bookings?per_page=100&include=approval_group,resource`,
      userToken
    );

    const bookingGroupIds = new Set();
    for (const b of (bookings.data || [])) {
      const rel = b?.relationships?.approval_group?.data;
      if (rel?.id) {
        bookingGroupIds.add(rel.id);
        console.log('📦 Booking requires group:', rel.id);
      }
    }

    // ---- 4) check eligibility (overlap between my groups and bookings' groups) ----
    let eligible = false;
    let overlap = [];
    if (bookingGroupIds.size) {
      overlap = [...bookingGroupIds].filter(id => myGroupIds.includes(id));
      eligible = overlap.length > 0;
    }

    console.log('🔍 Overlap groups:', overlap);
    console.log('✅ Eligible:', eligible);

    if (!eligible) {
      return Response.json({
        ok: false,
        error: 'Forbidden (not in booking approval group)',
        diag: {
          personId, myGroupIds, bookingGroupIds: [...bookingGroupIds], overlap
        }
      }, { status: 403 });
    }

    // ---- 5) call PCO approve/deny as the user ----
    const url = `${PCO.base}/event_resource_requests/${request_id}/${action}`;
    console.log('🚀 Calling PCO:', url);
    
    const result = await pcoPost(url, userToken, note ? { note } : {});

    console.log('✅ PCO approved/denied successfully');

    return Response.json({ ok: true, action, request_id, result });
  } catch (e) {
    console.error('❌ Approve error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});