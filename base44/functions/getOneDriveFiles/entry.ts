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

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            console.log('Token expired, refreshing...');
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Read folder_id from request body
        const body = await req.json();
        const folderId = body.folder_id || 'root';
        
        const path = folderId === 'root' 
            ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
            : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;

        console.log('Fetching OneDrive path:', path);
        console.log('Folder ID:', folderId);

        const response = await fetch(path, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OneDrive API error:', errorText);
            console.error('Status:', response.status);
            return Response.json({ 
                error: 'Failed to fetch OneDrive files',
                details: errorText,
                status: response.status
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('API returned', data.value?.length || 0, 'items');

        const items = data.value.map(item => ({
            id: item.id,
            name: item.name,
            isFolder: !!item.folder,
            size: item.size,
            webUrl: item.webUrl,
            downloadUrl: item['@microsoft.graph.downloadUrl'],
            modifiedDate: item.lastModifiedDateTime,
            createdDate: item.createdDateTime
        }));

        console.log('Returning', items.length, 'items for folder:', folderId);

        return Response.json({ items });

    } catch (error) {
        console.error('Get OneDrive files error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});