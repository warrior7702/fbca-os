import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📺 Fetching FBCA media from Resi...');

        // Fetch the main Resi page
        const resiUrl = 'https://sites.resi.io/fbcamedia';
        const response = await fetch(resiUrl);
        const html = await response.text();

        const collections = [];

        // Strategy: Find all "View All" links which indicate collections
        const viewAllRegex = /href="(\/fbcamedia\/explore\/[^"]+)"/g;
        const viewAllMatches = [...html.matchAll(viewAllRegex)];
        
        console.log(`🔍 Found ${viewAllMatches.length} collections`);

        for (const match of viewAllMatches) {
            const exploreUrl = match[1];
            const collectionId = exploreUrl.split('/').pop();
            
            // Find the collection name - look backwards from the link
            const linkIndex = html.indexOf(match[0]);
            const sectionBefore = html.substring(Math.max(0, linkIndex - 500), linkIndex);
            
            // Extract collection name from h2 or h1 tags
            const nameMatch = sectionBefore.match(/<h[12][^>]*>(?:\*\*)?([^<*]+)(?:\*\*)?<\/h[12]>/);
            let collectionName = nameMatch ? nameMatch[1].trim() : `Collection ${collectionId}`;
            
            // Find the section containing this collection's videos
            const sectionStart = html.indexOf(exploreUrl);
            const nextCollectionStart = html.indexOf('/fbcamedia/explore/', sectionStart + 50);
            const sectionEnd = nextCollectionStart > 0 ? nextCollectionStart : html.length;
            const sectionHtml = html.substring(sectionStart - 1000, sectionEnd);
            
            console.log(`📁 Processing: ${collectionName}`);
            
            // Find all video watch links in this section
            const videos = [];
            const videoRegex = /href="(\/fbcamedia\/watch\/[^"]+)"[^>]*>[\s\S]*?(?:src="([^"]*thumbnails[^"]+)"[\s\S]*?)?(?:alt="([^"]*)")?/g;
            const videoMatches = [...sectionHtml.matchAll(videoRegex)];
            
            console.log(`  📹 Found ${videoMatches.length} videos`);
            
            for (const videoMatch of videoMatches) {
                const videoPath = videoMatch[1];
                const thumbnail = videoMatch[2] || '';
                let title = videoMatch[3] || '';
                
                // Clean up title
                title = title.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
                
                // If no title, try to find it near the link
                if (!title || title.length < 3) {
                    const videoIndex = sectionHtml.indexOf(videoPath);
                    const videoContext = sectionHtml.substring(videoIndex, videoIndex + 300);
                    const titleMatch = videoContext.match(/\*\*([^*]+)\*\*/);
                    if (titleMatch) {
                        title = titleMatch[1].trim();
                    }
                }
                
                // Skip if still no valid title
                if (!title || title.length < 3) continue;
                
                const videoId = videoPath.split('/').pop();
                const videoUrl = `https://sites.resi.io${videoPath}`;
                
                // Extract date from title if present
                let date = null;
                const dateMatch = title.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4}/);
                if (dateMatch) {
                    date = dateMatch[0];
                }
                
                videos.push({
                    id: videoId,
                    title: title,
                    thumbnail: thumbnail,
                    videoUrl: videoUrl,
                    embedUrl: videoUrl,
                    date: date,
                    collectionId: collectionId
                });
            }
            
            // Only add collection if it has videos
            if (videos.length > 0) {
                collections.push({
                    id: collectionId,
                    name: collectionName,
                    url: `https://sites.resi.io${exploreUrl}`,
                    videos: videos.slice(0, 20) // Limit per collection
                });
                
                console.log(`  ✅ Added ${videos.length} videos to ${collectionName}`);
            }
        }

        // Get featured video (first video from first collection)
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

        console.log('✅ SUCCESS!');
        console.log(`📊 Stats: ${result.stats.totalCollections} collections, ${result.stats.totalVideos} videos`);
        
        if (collections.length > 0) {
            console.log('📂 Collections found:');
            collections.forEach(col => {
                console.log(`   - ${col.name}: ${col.videos.length} videos`);
            });
        }

        return Response.json(result);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({
            error: 'Failed to fetch Resi media',
            details: error.message
        }, { status: 500 });
    }
});