import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    const user = users[0];

    if (!user || !user.pco_person_id) {
      return Response.json({ 
        error: 'PCO person ID not found',
        pending_approvals: [],
        count: 0
      }, { status: 400 });
    }

    // Get parameters from request body
    const body = await req.json().catch(() => ({}));
    const pcoPersonId = Number(user.pco_person_id);
    const windowDays = Number.isFinite(Number(body.windowDays)) ? Number(body.windowDays) : 180;
    const debug = !!body.debug;

    const startedAt = new Date().toISOString();

    const PCO_SITE = "https://api.planningcenteronline.com";
    const PCO_APP_ID = Deno.env.get('PCO_CLIENT_ID');
    const PCO_SECRET = Deno.env.get('PCO_CLIENT_SECRET');

    if (!PCO_APP_ID || !PCO_SECRET) {
      return Response.json({
        success: false,
        error: "Missing PCO credentials",
        pending_approvals: [],
        count: 0,
      });
    }

    // -----------------------------
    // helpers
    // -----------------------------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const authHeader = "Basic " + btoa(`${PCO_APP_ID}:${PCO_SECRET}`);

    async function pcoFetch(url, { method = "GET" } = {}, attempt = 0) {
      const maxAttempts = 6;

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const retryMs = retryAfter ? Number(retryAfter) * 1000 : Math.min(30_000, 500 * Math.pow(2, attempt));
        if (attempt >= maxAttempts) {
          const body = await safeJson(res);
          throw new Error(`PCO 429 too many retries. url=${url} body=${JSON.stringify(body).slice(0, 500)}`);
        }
        await sleep(retryMs);
        return pcoFetch(url, { method }, attempt + 1);
      }

      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(
          `PCO HTTP ${res.status} ${res.statusText} url=${url} body=${JSON.stringify(body).slice(0, 1000)}`
        );
      }

      return res.json();
    }

    async function safeJson(res) {
      try {
        return await res.json();
      } catch {
        return { nonJson: true };
      }
    }

    async function fetchAllPages(firstUrl, debugSink) {
      const out = [];
      let url = firstUrl;
      let page = 0;

      while (url) {
        page++;
        const json = await pcoFetch(url);

        if (Array.isArray(json?.data)) out.push(...json.data);

        const next = json?.links?.next;
        url = next || null;

        if (debug && debugSink) {
          debugSink.push({
            page,
            fetched: Array.isArray(json?.data) ? json.data.length : 0,
            hasNext: !!next,
            url: url || firstUrl,
          });
        }
      }

      return out;
    }

    function isoDaysAgo(days) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString();
    }

    function intersect(aSet, bSet) {
      for (const v of aSet) if (bSet.has(v)) return true;
      return false;
    }

    const resourceGroupsCache = new Map();

    async function getResourceApprovalGroupIds(resourceId) {
      const rid = String(resourceId);
      if (resourceGroupsCache.has(rid)) return resourceGroupsCache.get(rid);

      const url = `${PCO_SITE}/calendar/v2/resources/${encodeURIComponent(rid)}/resource_approval_groups`;
      const json = await pcoFetch(url);

      const groupIds = new Set(
        (json?.data || [])
          .map((g) => g?.id)
          .filter(Boolean)
          .map(String)
      );

      resourceGroupsCache.set(rid, groupIds);
      return groupIds;
    }

    // -----------------------------
    // 1) my approval groups
    // -----------------------------
    const membershipPages = [];
    const membershipUrl =
      `${PCO_SITE}/calendar/v2/resource_approval_group_memberships` +
      `?where[person_id]=${encodeURIComponent(String(pcoPersonId))}` +
      `&include=resource_approval_group`;

    const memberships = await fetchAllPages(membershipUrl, membershipPages);

    const myGroupIds = new Set();
    for (const m of memberships) {
      const rel = m?.relationships?.resource_approval_group?.data;
      if (rel?.id) myGroupIds.add(String(rel.id));
    }

    // -----------------------------
    // 2) pending event resource requests
    // -----------------------------
    const pendingPages = [];
    const sinceIso = isoDaysAgo(windowDays);

    const pendingUrl =
      `${PCO_SITE}/calendar/v2/event_resource_requests` +
      `?where[approval_status]=P` +
      `&include=event,resource` +
      `&per_page=100`;

    const pending = await fetchAllPages(pendingUrl, pendingPages);

    // -----------------------------
    // 3) filter by resource -> groups intersection
    // -----------------------------
    const kept = [];
    const dropReasons = [];

    for (const req of pending) {
      const reqId = String(req.id);

      const createdAt = req?.attributes?.created_at || req?.attributes?.createdAt || null;
      const updatedAt = req?.attributes?.updated_at || req?.attributes?.updatedAt || null;
      const ts = createdAt || updatedAt;

      if (ts && new Date(ts).toISOString() < sinceIso) {
        if (debug) dropReasons.push({ reqId, reason: "outside_window", ts });
        continue;
      }

      const resourceRel = req?.relationships?.resource?.data;
      const eventRel = req?.relationships?.event?.data;

      const resourceId = resourceRel?.id ? String(resourceRel.id) : null;
      const eventId = eventRel?.id ? String(eventRel.id) : null;

      if (!resourceId) {
        if (debug) dropReasons.push({ reqId, reason: "missing_resource_relationship" });
        continue;
      }

      const resourceGroupIds = await getResourceApprovalGroupIds(resourceId);

      if (!intersect(resourceGroupIds, myGroupIds)) {
        if (debug)
          dropReasons.push({
            reqId,
            reason: "no_group_intersection",
            resourceId,
            resourceGroupIds: [...resourceGroupIds],
            myGroupIds: [...myGroupIds],
          });
        continue;
      }

      kept.push({
        user_email: currentUser.email,
        request_id: reqId,
        event_id: eventId,
        event_name: req?.attributes?.event_title || req?.attributes?.eventTitle || null,
        event_starts_at: null,
        event_ends_at: null,
        resource_id: resourceId,
        resource_name: req?.attributes?.resource_name || req?.attributes?.resourceName || null,
        approval_group_name: null,
        quantity: req?.attributes?.quantity || 1,
        approval_status: 'P',
        pco_created_at: createdAt,
        pco_updated_at: updatedAt
      });
    }

    // Update database
    const existingApprovals = await base44.asServiceRole.entities.PendingApproval.filter({
      user_email: currentUser.email
    }).catch(() => []);

    for (const existing of existingApprovals) {
      try {
        await base44.asServiceRole.entities.PendingApproval.delete(existing.id);
      } catch (error) {
        console.error('Error deleting approval:', error);
      }
    }

    for (const approval of kept) {
      try {
        await base44.asServiceRole.entities.PendingApproval.create(approval);
      } catch (error) {
        console.error('Error creating approval:', error);
      }
    }

    const result = {
      success: true,
      pending_approvals: kept,
      count: kept.length,
      my_groups_count: myGroupIds.size,
      startedAt,
    };

    if (debug) {
      result.debug = {
        pcoPersonId,
        windowDays,
        sinceIso,
        memberships: {
          fetched: memberships.length,
          myGroupIds: [...myGroupIds],
          pages: membershipPages,
        },
        pending: {
          fetched: pending.length,
          pages: pendingPages,
        },
        resourceGroupsCacheSize: resourceGroupsCache.size,
        dropped: dropReasons.slice(0, 200),
      };
    }

    return Response.json(result);

  } catch (error) {
    console.error('❌ Sync error:', error);
    return Response.json({ 
      error: error.message,
      pending_approvals: [],
      count: 0
    }, { status: 500 });
  }
});