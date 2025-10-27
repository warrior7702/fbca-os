import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { loadClickUpConfig, getListConfig } from './utils/clickupConfig.js';
import {
  getAllowedStatuses,
  resolveStatus,
  findTaskByCustomField,
  updateTaskStatus,
  createIdempotencyKey,
  checkIdempotency,
  setIdempotency
} from './utils/clickupStatusUtils.js';

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

        // Parse request body
        const body = await req.json();
        const {
            pco_request_id,
            new_status,
            list_id_hint,
            updated_at,
            dry_run = false
        } = body;

        // Validate required fields
        if (!pco_request_id || !new_status) {
            return Response.json({
                error: 'Missing required fields: pco_request_id, new_status'
            }, { status: 400 });
        }

        // Structured logging
        const logContext = {
            requestId,
            pcoRequestId: pco_request_id,
            incomingStatus: new_status,
            listIdHint: list_id_hint,
            dryRun: dry_run,
            timestamp: new Date().toISOString()
        };

        console.log('[ClickUp Update] Starting:', logContext);

        // Check idempotency
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

        // Load configuration
        const config = await loadClickUpConfig();
        console.log('[ClickUp Update] Config loaded:', {
            listsCount: config.lists?.length || 0
        });

        // Determine target list
        let listConfig = list_id_hint ? getListConfig(list_id_hint, config) : null;
        
        if (!listConfig && config.lists.length > 0) {
            // Fallback to first list (or implement more sophisticated lookup)
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

        // Get default values from environment if not in config
        const teamId = team_id || Deno.env.get('CLICKUP_TEAM_ID');
        const customFieldId = cf_pco_request_id || Deno.env.get('CLICKUP_CF_PCO_REQUEST_ID');

        if (!teamId || !customFieldId) {
            return Response.json({
                error: 'Missing team_id or cf_pco_request_id in config'
            }, { status: 422 });
        }

        // Find task by PCO request ID
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

        // Get allowed statuses for this list
        const allowedStatuses = await getAllowedStatuses({
            listId: list_id,
            token: user.clickup_access_token
        });

        // Resolve status using mapping
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

        // Update task status
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

        // Cache result for idempotency
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

        // Determine if error is retryable
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