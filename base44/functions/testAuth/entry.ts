import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🧪 TEST FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        console.log('✅ User authenticated:', user?.email, '| Role:', user?.role);
        
        return Response.json({
            success: true,
            message: 'Authentication works!',
            user: {
                email: user?.email,
                role: user?.role,
                hasMicrosoftToken: !!user?.microsoft_access_token
            }
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});