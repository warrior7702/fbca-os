import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function basicAuthHeader() {
  const id = Deno.env.get('PCO_CLIENT_ID') || '';
  const secret = Deno.env.get('PCO_CLIENT_SECRET') || '';
  if (!id || !secret) return null;
  const token = btoa(`${id}:${secret}`);
  return { Authorization: `Basic ${token}` };
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, text };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User email not found' }, { status: 400 });
    }

    let approvalGroupNames: string[] = [];
    let mode = 'app_credentials'; // Default mode assumes app credentials
    let lastError: string | null = null;

    // Prefer using the user's own PCO token and the group membership endpoint.
    if (user?.pco_access_token) {
      mode = 'user_token';
      try {
        // Look up the current person's ID via the user token
        const meResp = await fetch('https://api.planningcenteronline.com/people/v2/me', {
          headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
        });
        if (!meResp.ok) {
          lastError = `Person lookup failed: ${meResp.status} ${await meResp.text()}`;
        } else {
          const meData = await meResp.json();
          const personId = (meData as any)?.data?.id;
          if (personId) {
            // Fetch group memberships for this person and accumulate names
            const seenIds = new Set<string>();
            let nextUrl: string | null = `https://api.planningcenteronline.com/calendar/v2/resource_approval_group_memberships?where[person_id]=${personId}&per_page=200&include=resource_approval_group`;
            while (nextUrl) {
              const memResp = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
              });
              if (!memResp.ok) {
                lastError = `Membership lookup failed: ${memResp.status} ${await memResp.text()}`;
                break;
              }
              const memData = await memResp.json();
              // Extract names from included groups
              const included = (memData as any)?.included || [];
              for (const inc of included) {
                const gId = inc?.id;
                const gName = inc?.attributes?.name;
                if (gId && gName && !seenIds.has(gId)) {
                  seenIds.add(gId);
                  approvalGroupNames.push(gName);
                }
              }
              // Follow pagination links if present
              nextUrl = (memData as any)?.links?.next || null;
            }
          } else {
            lastError = 'Person ID not found in response';
          }
        }
      } catch (err: any) {
        lastError = `Membership lookup error: ${err?.message || err}`;
      }
    }

    // Fall back to Basic Auth search if no groups were found via user token
    if (approvalGroupNames.length === 0) {
      const appAuth = basicAuthHeader();
      if (!appAuth) {
        return Response.json({
          error: 'PCO app credentials not configured',
          success: false
        }, { status: 200 });
      }
      mode = 'app_credentials';
      const searchUrl = `https://api.planningcenteronline.com/people/v2/people?per_page=10&where[search]=${encodeURIComponent(user.email)}`;
      const people = await fetchJson(searchUrl, appAuth);
      const personId = (people.data as any)?.data?.[0]?.id;
      if (people.ok && personId) {
        const groupsUrl = `https://api.planningcenteronline.com/calendar/v2/people/${personId}/resource_approval_groups?per_page=100`;
        const groups = await fetchJson(groupsUrl, appAuth);
        if (groups.ok) {
          approvalGroupNames = ((groups.data as any)?.data || []).map((g: any) => g.attributes?.name).filter(Boolean);
        } else {
          lastError = `Groups lookup failed: ${groups.status} ${groups.text || ''}`.trim();
        }
      } else {
        lastError = `People lookup failed: ${people.status} ${people.text || ''}`.trim();
      }
    }

    return Response.json({
      success: true,
      approvalGroupNames,
      count: approvalGroupNames.length,
      mode,
      warning: lastError || undefined
    });

  } catch (error) {
    console.error('❌ Error fetching user groups:', error);
    return Response.json({
      error: error.message || 'Unknown error',
      success: false
    }, { status: 200 });
  }
});