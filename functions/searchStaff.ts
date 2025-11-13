import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const { query } = await req.json().catch(() => ({ query: '' }));

        if (!query || query.length < 2) {
            return Response.json({ 
                results: [],
                message: 'Query too short'
            });
        }

        console.log('🔍 Searching for:', query);

        // Get Microsoft access token - MANUAL FIRST!
        let accessToken = null;
        let tokenSource = null;

        // Try manual token first (it has permissions!)
        if (user.microsoft_access_token) {
            accessToken = user.microsoft_access_token.trim();
            tokenSource = 'Manual';
            console.log('✅ Using manual Microsoft token');
        } else {
            // Fallback to SSO
            console.log('⚠️ No manual token, trying SSO...');
            try {
                const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
                if (ssoToken) {
                    // Clean the token
                    let cleanToken = ssoToken.trim();
                    if (cleanToken.startsWith('Bearer ')) {
                        cleanToken = cleanToken.substring(7);
                    }
                    cleanToken = cleanToken.replace(/\s/g, '');
                    
                    if (cleanToken.split('.').length === 3) {
                        accessToken = cleanToken;
                        tokenSource = 'SSO';
                        console.log('✅ Using SSO token (cleaned)');
                    }
                }
            } catch (ssoError) {
                console.log('❌ SSO error:', ssoError.message);
            }
        }

        if (!accessToken) {
            console.log('❌ No Microsoft token available');
            return Response.json({
                error: 'Microsoft 365 not connected',
                results: []
            }, { status: 400 });
        }

        console.log('🔑 Token source:', tokenSource);

        // Search Microsoft Graph for users matching the query
        const searchUrl = `https://graph.microsoft.com/v1.0/users?$search="displayName:${encodeURIComponent(query)}" OR "mail:${encodeURIComponent(query)}"&$select=id,displayName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones&$top=10`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'ConsistencyLevel': 'eventual'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Microsoft Graph error:', response.status, errorText);
            
            if (response.status === 403) {
                return Response.json({
                    error: tokenSource === 'SSO' 
                        ? 'SSO does not have directory permissions. Please connect Microsoft manually in Settings.'
                        : 'Insufficient permissions to search directory',
                    results: []
                }, { status: 403 });
            }
            
            return Response.json({
                error: 'Failed to search Microsoft directory',
                results: []
            }, { status: response.status });
        }

        const data = await response.json();
        const users = data.value || [];

        console.log(`✅ Found ${users.length} users`);

        // Format results with profile photos
        const results = await Promise.all(users.map(async (u) => {
            let photoUrl = null;
            
            // Try to get profile photo
            try {
                const photoResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${u.id}/photo/$value`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );
                
                if (photoResponse.ok) {
                    const photoBlob = await photoResponse.blob();
                    const photoBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(photoBlob);
                    });
                    photoUrl = photoBase64;
                }
            } catch (photoError) {
                // Photo not available, that's okay
                console.log('No photo for user:', u.displayName);
            }

            return {
                id: u.id,
                name: u.displayName,
                email: u.mail,
                jobTitle: u.jobTitle,
                department: u.department,
                location: u.officeLocation,
                phone: u.businessPhones?.[0] || u.mobilePhone,
                photoUrl: photoUrl
            };
        }));

        return Response.json({
            success: true,
            results: results,
            count: results.length,
            tokenSource: tokenSource
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        return Response.json({
            error: 'Failed to search staff',
            details: error.message,
            results: []
        }, { status: 500 });
    }
});