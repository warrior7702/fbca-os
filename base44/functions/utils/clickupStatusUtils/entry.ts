const CU_BASE = 'https://api.clickup.com/api/v2';

// Cache for list statuses: { listId: { statuses: Set, expires: timestamp } }
const statusCache = new Map();

export async function getAllowedStatuses({ listId, token }) {
  // Check cache first
  const cached = statusCache.get(listId);
  if (cached && Date.now() < cached.expires) {
    return cached.statuses;
  }

  // Fetch from ClickUp API
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
  
  // Extract status names and metadata
  const statuses = new Set();
  const statusDetails = new Map();
  
  (data.statuses || []).forEach(s => {
    statuses.add(s.status);
    statusDetails.set(s.status, {
      type: s.type,
      color: s.color,
      orderindex: s.orderindex
    });
  });

  // Cache for 20 minutes
  statusCache.set(listId, {
    statuses,
    statusDetails,
    expires: Date.now() + (20 * 60 * 1000)
  });

  return statuses;
}

export function normalizeStatus(status) {
  return String(status).trim().toLowerCase();
}

export function resolveStatus({ incoming, statusMap, allowedStatuses }) {
  // 1. Direct mapping (if map exists)
  let target = statusMap?.[incoming] || incoming;

  // 2. Exact match in allowed statuses
  if (allowedStatuses.has(target)) {
    return target;
  }

  // 3. Case-insensitive + whitespace-insensitive match
  const normalized = normalizeStatus(target);
  for (const allowed of allowedStatuses) {
    if (normalizeStatus(allowed) === normalized) {
      return allowed; // Return the exact status from ClickUp
    }
  }

  // 4. No match found - throw error
  const available = Array.from(allowedStatuses).join(', ');
  throw new Error(
    `Status mapping failed: "${incoming}" → "${target}" not found in allowed statuses [${available}]`
  );
}

export async function findTaskByCustomField({ token, teamId, customFieldId, value }) {
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

export async function updateTaskStatus({ token, taskId, status, currentStatus, dryRun = false }) {
  // Skip update if status hasn't changed
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
    
    // Handle rate limiting
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

export function createIdempotencyKey({ requestId, status, updatedAt }) {
  const timestamp = updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString();
  return `${requestId}:${normalizeStatus(status)}:${timestamp.split('T')[0]}`; // Daily granularity
}

// Simple in-memory idempotency cache (can be replaced with Redis/KV)
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function checkIdempotency(key) {
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return { isDuplicate: true, result: cached.result };
  }
  return { isDuplicate: false };
}

export function setIdempotency(key, result) {
  idempotencyCache.set(key, {
    result,
    expires: Date.now() + IDEMPOTENCY_TTL
  });
  
  // Clean up old entries periodically
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now >= v.expires) {
        idempotencyCache.delete(k);
      }
    }
  }
}