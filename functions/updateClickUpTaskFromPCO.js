import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// ===== CONFIG MANAGEMENT =====
let configCache = null;
let cacheExpiry = 0;

function loadClickUpConfig() {
  if (configCache && Date.now() < cacheExpiry) {
    return configCache;
  }

  const configJson = Deno.env.get('CLICKUP_MAPPING_JSON');
  
  if (!configJson) {
    configCache = { lists: [] };
  } else {
    try {
      configCache = JSON.parse(configJson);
    } catch (error) {
      console.error('Failed to parse CLICKUP_MAPPING_JSON:', error);
      configCache = { lists: [] };
    }
  }

  cacheExpiry = Date.now() + (5 * 60 * 1000);
  return configCache;
}

function getListConfig(listId, config) {
  return config.lists.find(l => l.list_id === String(listId));
}

// ===== STATUS MANAGEMENT =====
const CU_BASE = 'https://api.clickup.com/api/v2';
const statusCache = new Map();

async function getAllowedStatuses({ listId, token }) {
  const cached = statusCache.get(listId);
  if (cached && Date.now() < cached.expires) {
    return cached.statuses;
  }

  const response = await fetch(`${CU_BASE}/list/${listId}`, {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch list statuses for ${listId}:`, errorText);
    throw new Error(`ClickUp list fetch failed: ${response.status}`);
  }

  const data = await response.json();
  const statuses = new Set((data.statuses || []).map(s => s.status));

  statusCache.set(listId, {
    statuses,
    expires: Date.now() + (20 * 60 * 1000)
  });

  return statuses;
}

function normalizeStatus(status) {
  return String(status).trim().toLowerCase();
}

function resolveStatus({ incoming, statusMap, allowedStatuses }) {
  let target = statusMap?.[incoming] || incoming;

  if (allowedStatuses.has(target)) {
    return target;
  }

  const normalized = normalizeStatus(target);
  for (const allowed of allowedStatuses) {
    if (normalizeStatus(allowed) === normalized) {
      return allowed;
    }
  }

  const available = Array.from(allowedStatuses).join(', ');
  throw new Error(
    `Status mapping failed: "${incoming}" → "${target}" not found in allowed statuses [${available}]`
  );
}

async function findTaskByCustomField({ token, teamId, customFieldId, value }) {
  const searchUrl = `${CU_BASE}/team/${teamId}/task`;
  
  const searchBody = {
    page: 0,
    include_closed: true,
    subtasks: true,
    custom_fields: [{
      field_id: customFieldId,
      operator: '=',
      value: String(value)
    }]
  };

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(searchBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ClickUp search failed:', errorText);
    throw new Error(`ClickUp task search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.tasks?.[0] || null;
}

async function updateTaskStatus({ token, taskId, status, currentStatus, dryRun = false }) {
  if (normalizeStatus(status) === normalizeStatus(currentStatus)) {
    return {
      ok: true,
      skipped: true,
      reason: 'Status unchanged',
      taskId,
      status
    };
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would update task ${taskId} status to: ${status}`);
    return {
      ok: true,
      dryRun: true,
      taskId,
      status
    };
  }

  const response = await fetch(`${CU_BASE}/task/${taskId}`, {
    method: 'PUT',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update task ${taskId}:`, errorText);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited. Retry after ${retryAfter}s`);
    }
    
    throw new Error(`ClickUp update failed: ${response.status}`);
  }

  return {
    ok: true,
    taskId,
    status,
    updated: true
  };
}

// ===== IDEMPOTENCY =====
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

function createIdempotencyKey({ requestId, status, updatedAt }) {
  const timestamp = updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString();
  return `${requestId}:${normalizeStatus(status)}:${timestamp.split('T')[0]}`;
}

function checkIdempotency(key) {
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return { isDuplicate: true, result: cached.result };
  }
  return { isDuplicate: false };
}

function setIdempotency(key, result) {
  idempotencyCache.set(key, {
    result,
    expires: Date.now() + IDEMPOTENCY_TTL
  });
  
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now >= v.expires) {
        idempotencyCache.delete(k);
      }
    }
  }
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.clickup_access_token) {
            return Response.json({ error: 'ClickUp not connected' }, { status: 400 });
        }

        const body = await req.json();
        const {
            pco_request_id,
            new_status,
            list_id_hint,
            updated_at,
            dry_run = false
        } = body;

        if (!pco_request_id || !new_status) {
            return Response.json({
                error: 'Missing required fields: pco_request_id, new_status'
            }, { status: 400 });
        }

        const logContext = {
            requestId,
            pcoRequestId: pco_request_id,
            incomingStatus: new_status,
            listIdHint: list_id_hint,
            dryRun: dry_run,
            timestamp: new Date().toISOString()
        };

        console.log('[ClickUp Update] Starting:', logContext);

        const idempotencyKey = createIdempotencyKey({
            requestId: pco_request_id,
            status: new_status,
            updatedAt: updated_at
        });

        const { isDuplicate, result: cachedResult } = checkIdempotency(idempotencyKey);
        if (isDuplicate) {
            console.log('[ClickUp Update] Duplicate request (idempotent):', {
                ...logContext,
                idempotencyKey
            });
            return Response.json({
                ...cachedResult,
                cached: true
            });
        }

        const config = loadClickUpConfig();
        console.log('[ClickUp Update] Config loaded:', {
            listsCount: config.lists?.length || 0
        });

        let listConfig = list_id_hint ? getListConfig(list_id_hint, config) : null;
        
        if (!listConfig && config.lists.length > 0) {
            listConfig = config.lists[0];
            console.log('[ClickUp Update] Using fallback list:', {
                listId: listConfig.list_id
            });
        }

        if (!listConfig) {
            return Response.json({
                error: 'No list configuration found. Please set CLICKUP_MAPPING_JSON.'
            }, { status: 422 });
        }

        const { list_id, team_id, cf_pco_request_id, status_map } = listConfig;

        const teamId = team_id || Deno.env.get('CLICKUP_TEAM_ID');
        const customFieldId = cf_pco_request_id || Deno.env.get('CLICKUP_CF_PCO_REQUEST_ID');

        if (!teamId || !customFieldId) {
            return Response.json({
                error: 'Missing team_id or cf_pco_request_id in config'
            }, { status: 422 });
        }

        console.log('[ClickUp Update] Searching for task:', {
            ...logContext,
            teamId,
            customFieldId
        });

        const task = await findTaskByCustomField({
            token: user.clickup_access_token,
            teamId,
            customFieldId,
            value: pco_request_id
        });

        if (!task) {
            const result = {
                ok: true,
                note: 'No matching task found yet',
                pcoRequestId: pco_request_id
            };
            
            console.log('[ClickUp Update] Task not found:', logContext);
            setIdempotency(idempotencyKey, result);
            
            return Response.json(result);
        }

        console.log('[ClickUp Update] Task found:', {
            ...logContext,
            taskId: task.id,
            currentStatus: task.status?.status
        });

        const allowedStatuses = await getAllowedStatuses({
            listId: list_id,
            token: user.clickup_access_token
        });

        let resolvedStatus;
        try {
            resolvedStatus = resolveStatus({
                incoming: new_status,
                statusMap: status_map,
                allowedStatuses
            });
            
            console.log('[ClickUp Update] Status resolved:', {
                ...logContext,
                resolvedStatus
            });
        } catch (error) {
            console.error('[ClickUp Update] Status resolution failed:', {
                ...logContext,
                error: error.message
            });
            
            return Response.json({
                error: error.message,
                incoming_status: new_status,
                allowed_statuses: Array.from(allowedStatuses),
                mapping: status_map
            }, { status: 422 });
        }

        const updateResult = await updateTaskStatus({
            token: user.clickup_access_token,
            taskId: task.id,
            status: resolvedStatus,
            currentStatus: task.status?.status,
            dryRun: dry_run
        });

        const finalResult = {
            ...updateResult,
            pcoRequestId: pco_request_id,
            incomingStatus: new_status,
            resolvedStatus,
            listId: list_id,
            duration: Date.now() - startTime
        };

        console.log('[ClickUp Update] Complete:', finalResult);

        setIdempotency(idempotencyKey, finalResult);

        return Response.json(finalResult);

    } catch (error) {
        const errorLog = {
            requestId,
            error: error.message,
            stack: error.stack,
            duration: Date.now() - startTime
        };
        
        console.error('[ClickUp Update] Error:', errorLog);

        const isRetryable = error.message.includes('Rate limited') || 
                           error.message.includes('500') ||
                           error.message.includes('503');

        return Response.json({
            error: error.message,
            retryable: isRetryable,
            requestId
        }, { status: isRetryable ? 503 : 500 });
    }
});