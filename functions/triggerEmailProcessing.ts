import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Cron-friendly endpoint to trigger email processing
 * This endpoint can be called by external cron services (Vercel Cron, GitHub Actions, etc.)
 * 
 * Authentication: Requires CRON_SECRET environment variable to match
 */

Deno.serve(async (req) => {
    try {
        // Get secret from request (query param or header)
        const url = new URL(req.url);
        const providedSecret = url.searchParams.get('secret') || req.headers.get('x-cron-secret');
        
        // Check if secret matches
        const CRON_SECRET = Deno.env.get('CRON_SECRET');
        
        if (!CRON_SECRET) {
            console.error('❌ CRON_SECRET not set in environment variables');
            return Response.json({ 
                error: 'Server configuration error' 
            }, { status: 500 });
        }
        
        if (providedSecret !== CRON_SECRET) {
            console.error('❌ Invalid cron secret provided');
            return Response.json({ 
                error: 'Unauthorized - invalid secret' 
            }, { status: 401 });
        }

        console.log('✅ Cron secret validated');
        
        const base44 = createClientFromRequest(req);
        
        // Get the designated service user (first admin/super_user with Microsoft connected)
        // Or you can hardcode a specific email here
        const users = await base44.asServiceRole.entities.User.filter({
            microsoft_access_token: { $ne: null }
        });
        
        if (!users || users.length === 0) {
            console.error('❌ No users with Microsoft 365 connected');
            return Response.json({ 
                error: 'No service account configured' 
            }, { status: 500 });
        }
        
        // Use first user with Microsoft connected (or pick admin)
        const serviceUser = users.find(u => u.role === 'admin' || u.role === 'super_user') || users[0];
        
        console.log('🔧 Using service account:', serviceUser.email);
        
        // Call processServiceEmails with the service user's context
        // We need to create a fake request with the user's auth token
        const processResponse = await fetch(
            `${url.origin}/functions/processServiceEmails`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceUser.id}`, // Base44 uses user ID for auth
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const result = await processResponse.json();
        
        console.log('📊 Email processing complete:', result);
        
        return Response.json({
            success: true,
            message: 'Email processing triggered successfully',
            summary: result.summary || result,
            service_account: serviceUser.email,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Trigger email processing error:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});