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
            return Response.json({ files: [] });
        }

        // Check if token needs refresh
        const expiresAt = new Date(user.microsoft_token_expires_at);
        const now = new Date();
        
        let accessToken = user.microsoft_access_token;

        if (expiresAt <= now) {
            const refreshResponse = await base44.functions.invoke('refreshMicrosoftToken');
            accessToken = refreshResponse.data.access_token;
        }

        // Search OneDrive
        const searchUrl = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OneDrive search error:', errorText);
            return Response.json({ error: 'Search failed' }, { status: 500 });
        }

        const data = await response.json();

        // Group files by parent folder
        const folderMap = new Map();
        const standaloneItems = [];

        data.value.forEach(item => {
            const parentPath = item.parentReference?.path || '';
            const parentId = item.parentReference?.id || 'root';
            
            if (item.folder) {
                // It's a folder - add as standalone
                standaloneItems.push({
                    id: item.id,
                    name: item.name,
                    isFolder: true,
                    size: item.size,
                    webUrl: item.webUrl,
                    modifiedDate: item.lastModifiedDateTime,
                    path: parentPath,
                    itemCount: item.folder?.childCount || 0
                });
            } else {
                // It's a file - check if parent folder name matches query
                const parentName = item.parentReference?.name || '';
                const lowerQuery = query.toLowerCase();
                
                if (parentName.toLowerCase().includes(lowerQuery)) {
                    // File is in a matching folder - group by folder
                    if (!folderMap.has(parentId)) {
                        folderMap.set(parentId, {
                            id: parentId,
                            name: parentName,
                            isFolder: true,
                            webUrl: item.webUrl.split('/').slice(0, -1).join('/'),
                            path: parentPath,
                            fileCount: 0,
                            files: []
                        });
                    }
                    const folder = folderMap.get(parentId);
                    folder.fileCount++;
                    folder.files.push(item.name);
                } else {
                    // File name matches directly - add as standalone
                    standaloneItems.push({
                        id: item.id,
                        name: item.name,
                        isFolder: false,
                        size: item.size,
                        webUrl: item.webUrl,
                        downloadUrl: item['@microsoft.graph.downloadUrl'],
                        modifiedDate: item.lastModifiedDateTime,
                        path: parentPath
                    });
                }
            }
        });

        // Combine folders and standalone items
        const results = [...Array.from(folderMap.values()), ...standaloneItems];

        return Response.json({ files: results });

    } catch (error) {
        console.error('Search OneDrive error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});