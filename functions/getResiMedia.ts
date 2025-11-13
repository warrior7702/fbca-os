import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch Resi media site
        const resiUrl = 'https://sites.resi.io/fbcamedia';
        const response = await fetch(resiUrl);
        const html = await response.text();

        console.log('📺 Fetching Resi media from:', resiUrl);

        // Parse collections - looking for the section headers with "View All" links
        const collections = [];
        
        // More flexible regex to match collection titles and their explore links
        const collectionHeaderRegex = /<h[12][^>]*>([^<]+)<\/h[12]>[\s\S]*?href="([^"]*\/explore\/[^"]+)"/g;
        const collectionMatches = [...html.matchAll(collectionHeaderRegex)];
        
        console.log('🔍 Found', collectionMatches.length, 'collection headers');

        for (const match of collectionMatches) {
            let collectionName = match[1].trim();
            let exploreUrl = match[2];
            
            // Clean up collection name
            collectionName = collectionName.replace(/\*\*/g, '').trim();
            
            const collectionId = exploreUrl.split('/').pop();
            
            console.log('📁 Processing collection:', collectionName, '(ID:', collectionId + ')');
            
            // Find the section of HTML for this collection
            const sectionStart = html.indexOf(collectionName);
            const nextSectionStart = html.indexOf('<h1', sectionStart + 100);
            const sectionHtml = html.substring(sectionStart, nextSectionStart > 0 ? nextSectionStart : html.length);
            
            // Extract videos from this section - look for watch URLs and thumbnails
            const videos = [];
            const videoLinkRegex = /href="(\/fbcamedia\/watch\/[^"]+)"/g;
            const videoLinks = [...sectionHtml.matchAll(videoLinkRegex)];
            
            console.log('  📹 Found', videoLinks.length, 'video links');
            
            for (const videoLink of videoLinks) {
                const videoPath = videoLink[1];
                const videoUrl = `https://sites.resi.io${videoPath}`;
                const videoId = videoPath.split('/').pop();
                
                // Find thumbnail and title near this video link
                const linkIndex = sectionHtml.indexOf(videoPath);
                const videoSection = sectionHtml.substring(Math.max(0, linkIndex - 500), linkIndex + 500);
                
                // Extract thumbnail
                const thumbnailMatch = videoSection.match(/src="(https:\/\/lib\.resi\.media\/[^"]+)"/);
                const thumbnail = thumbnailMatch ? thumbnailMatch[1] : '';
                
                // Extract title - look for alt text or nearby text
                const altMatch = videoSection.match(/alt="([^"]+)"/);
                let title = altMatch ? altMatch[1] : `Video ${videos.length + 1}`;
                
                // Clean up title
                title = title.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
                
                // Extract date from title
                let date = null;
                const dateMatch = title.match(/(\w+ \d+, \d{4})/);
                if (dateMatch) {
                    date = dateMatch[1];
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
                    url: exploreUrl.startsWith('http') ? exploreUrl : `https://sites.resi.io${exploreUrl}`,
                    videos: videos.slice(0, 15) // Limit to 15 videos per collection
                });
                
                console.log('  ✅ Added collection with', videos.length, 'videos');
            }
        }

        // Get featured/latest video (first video from first collection)
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

        console.log('✅ Success! Found', result.stats.totalCollections, 'collections with', result.stats.totalVideos, 'total videos');

        return Response.json(result);

    } catch (error) {
        console.error('❌ Error fetching Resi media:', error);
        return Response.json({
            error: 'Failed to fetch Resi media',
            details: error.message
        }, { status: 500 });
    }
});