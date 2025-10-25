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

        console.log('Searching OneDrive for:', query);

        if (!query || query.length < 2) {
            return Response.json({ files: [] });
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

        // Search OneDrive
        const searchUrl = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`;
        console.log('Search URL:', searchUrl);

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
        console.log('Raw search results count:', data.value?.length || 0);
        
        if (data.value && data.value.length > 0) {
            console.log('First few results:', data.value.slice(0, 3).map(i => ({
                name: i.name,
                isFolder: !!i.folder
            })));
        }

        const lowerQuery = query.toLowerCase();

        // Separate folders and files
        const folders = [];
        const folderMap = new Map();
        const standaloneFiles = [];

        data.value.forEach(item => {
            console.log('Processing item:', item.name, 'isFolder:', !!item.folder);
            
            if (item.folder) {
                // It's a folder that matches the search
                if (!folderMap.has(item.id)) {
                    console.log('Adding folder:', item.name);
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
                
                console.log('File:', item.name, 'Parent:', parentName);
                
                // Check if parent folder name matches query
                if (parentName.toLowerCase().includes(lowerQuery)) {
                    // File's parent folder matches
                    if (parentId && !folderMap.has(parentId)) {
                        console.log('Adding parent folder:', parentName);
                        folders.push({
                            id: parentId,
                            name: parentName,
                            isFolder: true,
                            webUrl: item.webUrl.split('/').slice(0, -1).join('/'),
                            path: item.parentReference?.path || '',
                            fileCount: 1
                        });
                        folderMap.set(parentId, folders.length - 1);
                    } else if (parentId && typeof folderMap.get(parentId) === 'number') {
                        const folderIndex = folderMap.get(parentId);
                        folders[folderIndex].fileCount++;
                    }
                } else if (item.name.toLowerCase().includes(lowerQuery)) {
                    // File name itself matches query
                    console.log('Adding standalone file:', item.name);
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

        const results = [...folders, ...standaloneFiles];

        console.log('Final results:', {
            totalResults: results.length,
            folders: folders.length,
            standaloneFiles: standaloneFiles.length,
            folderNames: folders.map(f => f.name),
            fileNames: standaloneFiles.map(f => f.name)
        });

        return Response.json({ files: results });

    } catch (error) {
        console.error('Search OneDrive error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});