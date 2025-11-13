import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch FBCA podcasts page
        const podcastUrl = 'https://www.fbca.org/podcasts/';
        const response = await fetch(podcastUrl);
        const html = await response.text();

        // Parse podcasts from HTML
        const podcasts = [];
        
        // Look for podcast sections - adjust regex based on actual HTML structure
        const podcastRegex = /<div[^>]*class="[^"]*podcast[^"]*"[^>]*>.*?<img[^>]*src="([^"]*)".*?<h[23][^>]*>([^<]*)<\/h[23]>.*?<p[^>]*>([^<]*)<\/p>/gs;
        
        let match;
        while ((match = podcastRegex.exec(html)) !== null) {
            podcasts.push({
                id: podcasts.length + 1,
                thumbnail: match[1],
                title: match[2].trim(),
                description: match[3].trim(),
                episodes: 0 // Will need to scrape individual podcast pages for episode counts
            });
        }

        // Fallback: Try to find any images and titles if regex doesn't work
        if (podcasts.length === 0) {
            // Generic extraction - find headings and nearby images
            const titleRegex = /<h[23][^>]*>([^<]*(?:podcast|sermon|message)[^<]*)<\/h[23]>/gi;
            const titles = [...html.matchAll(titleRegex)];
            
            for (let i = 0; i < Math.min(titles.length, 5); i++) {
                const title = titles[i][1];
                // Try to find a nearby image
                const section = html.slice(Math.max(0, titles[i].index - 500), titles[i].index + 500);
                const imgMatch = section.match(/<img[^>]*src="([^"]*)"[^>]*>/);
                
                podcasts.push({
                    id: i + 1,
                    title: title.trim(),
                    description: 'FBCA Podcast',
                    thumbnail: imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&q=80',
                    episodes: 0
                });
            }
        }

        // If still no podcasts found, return default structure
        if (podcasts.length === 0) {
            return Response.json({
                success: true,
                podcasts: [
                    {
                        id: 1,
                        title: 'FBCA Sermons',
                        description: 'Weekly messages from First Baptist Church Arlington',
                        thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&q=80',
                        episodes: 0,
                        url: podcastUrl
                    }
                ],
                source: 'default'
            });
        }

        return Response.json({
            success: true,
            podcasts: podcasts.slice(0, 6), // Limit to 6 podcasts
            source: 'scraped'
        });

    } catch (error) {
        console.error('Error fetching FBCA podcasts:', error);
        return Response.json({
            error: 'Failed to fetch FBCA podcasts',
            details: error.message
        }, { status: 500 });
    }
});