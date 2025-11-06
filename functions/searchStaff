import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.microsoft_access_token) {
            return Response.json({ error: 'Microsoft 365 not connected' }, { status: 400 });
        }

        const body = await req.json();
        const query = body.query || '';

        if (!query || query.length < 2) {
            return Response.json({ people: [] });
        }

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Search for people in the organization
        const searchUrl = `https://graph.microsoft.com/v1.0/users?$search="displayName:${encodeURIComponent(query)}" OR "mail:${encodeURIComponent(query)}"&$top=10&$select=id,displayName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'ConsistencyLevel': 'eventual'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Microsoft Graph search error:', errorText);
            return Response.json({ error: 'Staff search failed' }, { status: 500 });
        }

        const data = await response.json();

        // Get profile photos for each person
        const people = await Promise.all(data.value.map(async (person) => {
            let photoUrl = null;
            
            try {
                const photoResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${person.id}/photo/$value`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );

                if (photoResponse.ok) {
                    const photoBlob = await photoResponse.blob();
                    const photoBuffer = await photoBlob.arrayBuffer();
                    const base64Photo = btoa(String.fromCharCode(...new Uint8Array(photoBuffer)));
                    photoUrl = `data:image/jpeg;base64,${base64Photo}`;
                }
            } catch (error) {
                console.log('No photo for', person.displayName);
            }

            return {
                id: person.id,
                name: person.displayName,
                email: person.mail,
                jobTitle: person.jobTitle,
                department: person.department,
                officeLocation: person.officeLocation,
                phone: person.businessPhones?.[0] || person.mobilePhone,
                photoUrl: photoUrl
            };
        }));

        return Response.json({ people });

    } catch (error) {
        console.error('Search staff error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});