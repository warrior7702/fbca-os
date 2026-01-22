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
    let mode = 'app_credentials'; // Default to app credentials
    let lastError: string | null = null;

    // Always use app credentials since user token is unreliable
    const appAuth = basicAuthHeader();
    if (!appAuth) {
      return Response.json({
        error: 'PCO app credentials not configured',
        success: false
      }, { status: 500 });
    }

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
      error: error.message,
      success: false
    }, { status: 500 });
  }
});