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
        const lowerQuery = query.toLowerCase();

        // Separate folders and files
        const folders = [];
        const folderMap = new Map(); // Track folders we've seen
        const standaloneFiles = [];

        data.value.forEach(item => {
            if (item.folder) {
                // It's a folder that matches the search
                if (!folderMap.has(item.id)) {
                    folders.push({
                        id: item.id,
                        name: item.name,
                        isFolder: true,
                        webUrl: item.webUrl,
                        path: item.parentReference?.path || '',
                        fileCount: item.folder?.childCount || 0
                    });
                    folderMap.set(item.id, true);
                }
            } else {
                // It's a file
                const parentName = item.parentReference?.name || '';
                const parentId = item.parentReference?.id;
                
                // Check if parent folder name matches query
                if (parentName.toLowerCase().includes(lowerQuery)) {
                    // File's parent folder matches - add folder if not already added
                    if (parentId && !folderMap.has(parentId)) {
                        folders.push({
                            id: parentId,
                            name: parentName,
                            isFolder: true,
                            webUrl: item.webUrl.split('/').slice(0, -1).join('/'),
                            path: item.parentReference?.path || '',
                            fileCount: 1 // We'll increment this if we find more files
                        });
                        folderMap.set(parentId, folders.length - 1); // Store index
                    } else if (parentId && typeof folderMap.get(parentId) === 'number') {
                        // Increment file count for this folder
                        const folderIndex = folderMap.get(parentId);
                        folders[folderIndex].fileCount++;
                    }
                } else if (item.name.toLowerCase().includes(lowerQuery)) {
                    // File name itself matches query (not in a matching folder)
                    standaloneFiles.push({
                        id: item.id,
                        name: item.name,
                        isFolder: false,
                        size: item.size,
                        webUrl: item.webUrl,
                        downloadUrl: item['@microsoft.graph.downloadUrl'],
                        path: item.parentReference?.path || ''
                    });
                }
            }
        });

        // Combine folders first, then standalone files
        const results = [...folders, ...standaloneFiles];

        console.log('Search results for:', query, 'Found:', results.length, 'items');
        console.log('Folders:', folders.map(f => f.name));
        console.log('Files:', standaloneFiles.map(f => f.name));

        return Response.json({ files: results });

    } catch (error) {
        console.error('Search OneDrive error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});