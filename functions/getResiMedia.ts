import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📺 ========== FETCHING RESI MEDIA ==========');

        const resiUrl = 'https://sites.resi.io/fbcamedia';
        console.log('🌐 Fetching:', resiUrl);
        
        const response = await fetch(resiUrl);
        const html = await response.text();
        
        console.log('📄 HTML received, length:', html.length);

        const collections = [];

        // Strategy 1: Find all "View All" or "explore" links
        const exploreLinks = [];
        const exploreLinkRegex = /href="(\/fbcamedia\/explore\/[^"]+)"/gi;
        let match;
        while ((match = exploreLinkRegex.exec(html)) !== null) {
            exploreLinks.push(match[1]);
        }
        
        console.log(`🔍 Found ${exploreLinks.length} explore links`);

        // Strategy 2: Also look for direct video watch links to group by collection
        const videoLinks = [];
        const videoLinkRegex = /href="(\/fbcamedia\/watch\/[^"]+)"/gi;
        while ((match = videoLinkRegex.exec(html)) !== null) {
            videoLinks.push(match[1]);
        }
        
        console.log(`🎥 Found ${videoLinks.length} video links`);

        // For each explore link, fetch that collection page
        for (const exploreLink of exploreLinks) {
            try {
                const collectionUrl = `https://sites.resi.io${exploreLink}`;
                console.log(`\n📂 Fetching collection: ${collectionUrl}`);
                
                const collectionResponse = await fetch(collectionUrl);
                const collectionHtml = await collectionResponse.text();
                
                // Get collection name from page title
                const titleMatch = collectionHtml.match(/<title>([^<]+)<\/title>/i);
                const collectionName = titleMatch ? titleMatch[1].replace(' | FBCA Media', '').trim() : 'Collection';
                
                console.log(`📁 Collection name: ${collectionName}`);
                
                // Extract collection ID
                const collectionId = exploreLink.split('/').pop();
                
                // Find all videos in this collection
                const videos = [];
                const videoMatches = collectionHtml.matchAll(/href="(\/fbcamedia\/watch\/([^"]+))"/gi);
                
                for (const videoMatch of videoMatches) {
                    const videoPath = videoMatch[1];
                    const videoId = videoMatch[2];
                    
                    // Find video details near this link
                    const videoIndex = collectionHtml.indexOf(videoPath);
                    const videoSection = collectionHtml.substring(Math.max(0, videoIndex - 500), videoIndex + 500);
                    
                    // Try to find title
                    let title = '';
                    const titleMatches = [
                        videoSection.match(/alt="([^"]+)"/),
                        videoSection.match(/title="([^"]+)"/),
                        videoSection.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/),
                    ];
                    
                    for (const tm of titleMatches) {
                        if (tm && tm[1] && tm[1].length > 3) {
                            title = tm[1].trim();
                            break;
                        }
                    }
                    
                    if (!title || title.length < 3) continue;
                    
                    // Find thumbnail
                    const thumbnailMatch = videoSection.match(/src="([^"]*(?:thumbnail|image)[^"]*)"/i);
                    const thumbnail = thumbnailMatch ? thumbnailMatch[1] : `https://i.vimeocdn.com/video/${videoId}_640.jpg`;
                    
                    // Extract date from title
                    let date = null;
                    const dateMatch = title.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,?\s+\d{4}/i);
                    if (dateMatch) {
                        date = dateMatch[0];
                    }
                    
                    videos.push({
                        id: videoId,
                        title: title,
                        thumbnail: thumbnail,
                        videoUrl: `https://sites.resi.io${videoPath}`,
                        embedUrl: `https://sites.resi.io${videoPath}`,
                        date: date,
                        collectionId: collectionId
                    });
                }
                
                console.log(`  ✅ Found ${videos.length} videos in ${collectionName}`);
                
                if (videos.length > 0) {
                    collections.push({
                        id: collectionId,
                        name: collectionName,
                        url: collectionUrl,
                        videos: videos
                    });
                }
                
            } catch (collectionError) {
                console.error(`❌ Error fetching collection ${exploreLink}:`, collectionError.message);
            }
        }

        // If no collections found, create a fallback with all videos
        if (collections.length === 0 && videoLinks.length > 0) {
            console.log('⚠️ No collections found, creating fallback collection with all videos');
            
            const fallbackVideos = [];
            for (const videoPath of videoLinks.slice(0, 20)) {
                const videoId = videoPath.split('/').pop();
                fallbackVideos.push({
                    id: videoId,
                    title: 'FBCA Video',
                    thumbnail: `https://i.vimeocdn.com/video/${videoId}_640.jpg`,
                    videoUrl: `https://sites.resi.io${videoPath}`,
                    embedUrl: `https://sites.resi.io${videoPath}`,
                    date: null,
                    collectionId: 'all'
                });
            }
            
            collections.push({
                id: 'all',
                name: 'FBCA Videos',
                url: resiUrl,
                videos: fallbackVideos
            });
        }

        const featured = collections[0]?.videos[0] || null;

        const result = {
            success: true,
            collections: collections,
            featured: featured,
            stats: {
                totalCollections: collections.length,
                totalVideos: collections.reduce((sum, col) => sum + col.videos.length, 0)
            }
        };

        console.log('\n✅ ========== RESI FETCH SUCCESS ==========');
        console.log(`📊 Collections: ${result.stats.totalCollections}`);
        console.log(`📊 Total Videos: ${result.stats.totalVideos}`);
        
        if (collections.length > 0) {
            console.log('\n📂 Collections breakdown:');
            collections.forEach(col => {
                console.log(`   - ${col.name}: ${col.videos.length} videos`);
            });
        }

        return Response.json(result);

    } catch (error) {
        console.error('\n❌ ========== RESI FETCH ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to fetch Resi media',
            details: error.message,
            collections: [],
            featured: null,
            stats: { totalCollections: 0, totalVideos: 0 }
        }, { status: 500 });
    }
});