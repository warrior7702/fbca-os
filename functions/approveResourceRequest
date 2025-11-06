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

async function pcoPatch(url, token, body = {}) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PATCH ${url} :: ${r.status} :: ${text}`);
  return text ? JSON.parse(text) : { ok: true };
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
    const groupResourceMap = {}; // Map group ID to list of resource IDs
    
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
        
        // Get resources for this group
        const resourcesResponse = await pcoGet(
          `${PCO.base}/resource_approval_groups/${group.id}/resources?per_page=100`,
          userToken
        );
        
        groupResourceMap[group.id] = (resourcesResponse.data || []).map(r => r.id);
        console.log('  ↳ Manages', groupResourceMap[group.id].length, 'resources');
      }
    }

    console.log('📋 My group IDs:', myGroupIds);

    // ---- 3) Get the request details to find the resource ----
    const requestResponse = await pcoGet(
      `${PCO.base}/event_resource_requests/${request_id}?include=resource`,
      userToken
    );

    const resourceId = requestResponse.data?.relationships?.resource?.data?.id;
    console.log('📦 Request is for resource:', resourceId);

    // ---- 4) Check if I have permission to approve this resource ----
    let hasPermission = false;
    
    // Check if any of my groups manage this resource
    for (const groupId of myGroupIds) {
      const groupResources = groupResourceMap[groupId] || [];
      if (groupResources.includes(resourceId)) {
        hasPermission = true;
        console.log('✅ Group', groupId, 'manages this resource');
        break;
      }
    }

    console.log('✅ Has permission:', hasPermission);

    if (!hasPermission) {
      return Response.json({
        ok: false,
        error: 'You are not authorized to approve this resource',
        diag: {
          personId,
          myGroupIds,
          resourceId,
          message: 'None of your approval groups manage this resource'
        }
      }, { status: 403 });
    }

    // ---- 5) PATCH the request to approve/deny ----
    const statusCode = action === 'approve' ? 'A' : 'R'; // A=Approved, R=Rejected
    const url = `${PCO.base}/event_resource_requests/${request_id}`;
    
    console.log('🚀 Patching PCO request:', url);
    console.log('  Status:', statusCode);
    
    const patchBody = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: statusCode
        }
      }
    };

    // Add note if provided
    if (note) {
      patchBody.data.attributes.notes = note;
    }

    const result = await pcoPatch(url, userToken, patchBody);

    console.log('✅ PCO request', action === 'approve' ? 'approved' : 'denied', 'successfully');

    return Response.json({ ok: true, action, request_id, result });
  } catch (e) {
    console.error('❌ Approve error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});