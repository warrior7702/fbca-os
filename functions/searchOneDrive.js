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

        console.log('🔍 Searching OneDrive for:', query);

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

        const lowerQuery = query.toLowerCase();
        let allResults = [];

        // APPROACH 1: Try Microsoft Graph search API
        try {
            const searchUrl = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`;
            console.log('Trying Graph API search...');

            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Graph API returned:', data.value?.length || 0, 'items');
                allResults = data.value || [];
            }
        } catch (error) {
            console.log('Graph API search failed:', error.message);
        }

        // APPROACH 2: If search returned nothing, manually list and filter folders
        if (allResults.length === 0) {
            console.log('Graph search empty, trying manual folder listing...');
            
            try {
                const listUrl = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
                const listResponse = await fetch(listUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    console.log('Listed', listData.value?.length || 0, 'root items');
                    
                    // Filter items that match the query
                    allResults = (listData.value || []).filter(item => 
                        item.name.toLowerCase().includes(lowerQuery)
                    );
                    console.log('Filtered to', allResults.length, 'matching items');
                }
            } catch (error) {
                console.log('Manual listing failed:', error.message);
            }
        }

        // Process results
        const folders = [];
        const folderMap = new Map();
        const standaloneFiles = [];

        allResults.forEach(item => {
            if (item.folder) {
                // It's a folder that matches
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
                
                if (parentName.toLowerCase().includes(lowerQuery)) {
                    // File's parent folder matches
                    if (parentId && !folderMap.has(parentId)) {
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
                    // File name matches
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

        console.log('✅ Final results:', {
            folders: folders.length,
            files: standaloneFiles.length,
            total: results.length
        });

        return Response.json({ files: results });

    } catch (error) {
        console.error('❌ Search error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});