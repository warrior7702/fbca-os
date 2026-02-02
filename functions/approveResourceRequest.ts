import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Approve or deny a Planning Center resource request as the logged‑in user.
 *
 * The caller must POST JSON or form‑encoded data with:
 *   - request_id (string): PCO event_resource_request ID to approve/deny.
 *   - action (string): "approve" or "deny".
 *   - note (optional string): text to append as a note in the PCO request.
 *
 * The function returns JSON with an `ok` flag indicating success. On failure
 * it includes an `error` message and the HTTP status from the PCO API.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Ensure we have an authenticated user
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Safely parse payload (JSON or form‑encoded)
    let body = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }

    const request_id = String(body.request_id || '').trim();
    const action = String(body.action || '').trim().toLowerCase();
    const note   = body.note ? String(body.note) : undefined;

    // Validate inputs
    if (!request_id || !['approve', 'deny'].includes(action)) {
      return Response.json(
        { ok: false, error: 'request_id and action=approve|deny required' },
        { status: 400 }
      );
    }

    // CRITICAL: fetch a FRESH PCO token from the user record.  Using the
    // token stored on the session (`me.pco_access_token`) can be stale or
    // belong to a different user.  By querying the User entity via
    // base44.asServiceRole, we ensure we use the current user’s token.
    const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
    const user  = users[0];
    if (!user?.pco_access_token) {
      return Response.json(
        { ok: false, error: 'No PCO token. Please reconnect Planning Center in Settings.' },
        { status: 401 }
      );
    }
    const userToken = user.pco_access_token;

    // Determine PCO status code: A=Approved, R=Rejected
    const statusCode = action === 'approve' ? 'A' : 'R';
    const url = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}`;

    // Build PATCH request body according to PCO Calendar v2 schema
    const patchBody = {
      data: {
        type: 'EventResourceRequest',
        id: request_id,
        attributes: {
          approval_status: statusCode,
        },
      },
    };
    if (note) {
      patchBody.data.attributes.notes = note;
    }

    // Make the PATCH call to update approval status
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    });

    const text = await resp.text();
    if (!resp.ok) {
      // Provide a friendly error message based on status
      let errorMsg = 'Permission denied';
      if (resp.status === 403) {
        errorMsg = 'You are not authorized to approve this resource. Make sure you are in the correct approval group.';
      } else if (resp.status === 404) {
        errorMsg = 'Request not found';
      } else {
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.errors?.[0]?.detail || text;
        } catch {
          errorMsg = text;
        }
      }
      return Response.json(
        { ok: false, error: errorMsg, status: resp.status, details: text },
        { status: resp.status },
      );
    }

    // Parse result; if there is no body, assume success
    const result = text ? JSON.parse(text) : { ok: true };
    return Response.json({
      ok: true,
      action,
      request_id,
      message: action === 'approve' ? 'Request approved successfully' : 'Request denied successfully',
      result,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
  }
});