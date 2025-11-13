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

        // Parse collections and videos from HTML
        const collections = [];
        
        // Extract collection sections
        const collectionRegex = /<h2[^>]*><a[^>]*href="([^"]*)"[^>]*><h1[^>]*>([^<]*)<\/h1>/g;
        const videoTileRegex = /<a[^>]*href="([^"]*watch\/[^"]*)"[^>]*>.*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)".*?<h5[^>]*>([^<]*)<\/h5>/gs;
        
        let match;
        const collectionMatches = [...html.matchAll(collectionRegex)];
        
        for (const collectionMatch of collectionMatches) {
            const collectionUrl = collectionMatch[1];
            const collectionName = collectionMatch[2];
            const collectionId = collectionUrl.split('/').pop();
            
            // Find videos in this collection
            const videos = [];
            const collectionSection = html.split(collectionUrl)[1]?.split('</section>')[0] || '';
            
            const videoMatches = [...collectionSection.matchAll(videoTileRegex)];
            for (const videoMatch of videoMatches) {
                const videoUrl = videoMatch[1];
                const thumbnail = videoMatch[2];
                const title = videoMatch[4] || videoMatch[3];
                const videoId = videoUrl.split('/').pop();
                
                // Extract date from title if present
                let date = null;
                const dateMatch = title.match(/(\w+ \d+, \d{4})/);
                if (dateMatch) {
                    date = dateMatch[1];
                }
                
                videos.push({
                    id: videoId,
                    title: title.trim(),
                    thumbnail,
                    videoUrl: `https://sites.resi.io${videoUrl}`,
                    embedUrl: `https://sites.resi.io${videoUrl}`,
                    date,
                    collectionId
                });
            }
            
            collections.push({
                id: collectionId,
                name: collectionName.trim(),
                url: `https://sites.resi.io${collectionUrl}`,
                videos: videos.slice(0, 12) // Limit to 12 videos per collection
            });
        }

        // Get featured/latest video (first video from first collection)
        const featured = collections[0]?.videos[0] || null;

        return Response.json({
            success: true,
            collections,
            featured,
            stats: {
                totalCollections: collections.length,
                totalVideos: collections.reduce((sum, col) => sum + col.videos.length, 0)
            }
        });

    } catch (error) {
        console.error('Error fetching Resi media:', error);
        return Response.json({
            error: 'Failed to fetch Resi media',
            details: error.message
        }, { status: 500 });
    }
});