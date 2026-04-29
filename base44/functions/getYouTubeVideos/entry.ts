import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📺 Fetching FBCA YouTube videos...');

        // FBCA YouTube channel handle
        const channelHandle = '@firstbaptistarlington';
        
        // Method 1: Try YouTube Data API if key is available
        const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
        
        if (youtubeApiKey) {
            console.log('🔑 Using YouTube Data API');
            return await fetchWithAPI(youtubeApiKey);
        }
        
        // Method 2: Fallback to RSS feed (last 15 videos, but reliable)
        console.log('📡 Using YouTube RSS feed');
        return await fetchWithRSS(channelHandle);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({
            error: 'Failed to fetch YouTube videos',
            details: error.message
        }, { status: 500 });
    }
});

async function fetchWithAPI(apiKey) {
    try {
        // First, get the channel ID from handle
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=firstbaptistarlington&key=${apiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchData.items || searchData.items.length === 0) {
            throw new Error('Channel not found');
        }
        
        const channelId = searchData.items[0].id.channelId;
        console.log(`📺 Found channel ID: ${channelId}`);
        
        // Get channel uploads playlist
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
        const channelResponse = await fetch(channelUrl);
        const channelData = await channelResponse.json();
        
        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
        
        // Get videos from uploads playlist
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`;
        const playlistResponse = await fetch(playlistUrl);
        const playlistData = await playlistResponse.json();
        
        const videos = playlistData.items.map(item => ({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            publishedAt: item.snippet.publishedAt,
            videoUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
            embedUrl: `https://www.youtube.com/embed/${item.snippet.resourceId.videoId}`
        }));
        
        console.log(`✅ Found ${videos.length} videos via API`);
        
        return Response.json({
            success: true,
            method: 'api',
            videos: videos,
            channelUrl: 'https://youtube.com/@firstbaptistarlington'
        });
        
    } catch (error) {
        console.error('API fetch failed:', error);
        throw error;
    }
}

async function fetchWithRSS(channelHandle) {
    try {
        // Fetch the channel page to get channel ID
        const channelUrl = `https://www.youtube.com/${channelHandle}`;
        const pageResponse = await fetch(channelUrl);
        const pageHtml = await pageResponse.text();
        
        // Extract channel ID from page
        const channelIdMatch = pageHtml.match(/"channelId":"([^"]+)"/);
        if (!channelIdMatch) {
            throw new Error('Could not find channel ID');
        }
        
        const channelId = channelIdMatch[1];
        console.log(`📺 Found channel ID: ${channelId}`);
        
        // Fetch RSS feed
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const rssResponse = await fetch(rssUrl);
        const rssText = await rssResponse.text();
        
        // Parse RSS XML
        const videos = [];
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        const entries = [...rssText.matchAll(entryRegex)];
        
        for (const entry of entries) {
            const entryContent = entry[1];
            
            const videoIdMatch = entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
            const publishedMatch = entryContent.match(/<published>([^<]+)<\/published>/);
            const thumbnailMatch = entryContent.match(/<media:thumbnail url="([^"]+)"/);
            const descriptionMatch = entryContent.match(/<media:description>([^<]*)<\/media:description>/);
            
            if (videoIdMatch && titleMatch) {
                const videoId = videoIdMatch[1];
                videos.push({
                    id: videoId,
                    title: titleMatch[1],
                    description: descriptionMatch ? descriptionMatch[1] : '',
                    thumbnail: thumbnailMatch ? thumbnailMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    publishedAt: publishedMatch ? publishedMatch[1] : null,
                    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`
                });
            }
        }
        
        console.log(`✅ Found ${videos.length} videos via RSS`);
        
        return Response.json({
            success: true,
            method: 'rss',
            videos: videos,
            channelUrl: 'https://youtube.com/@firstbaptistarlington',
            note: 'RSS feed shows last 15 videos. Add YOUTUBE_API_KEY for full access.'
        });
        
    } catch (error) {
        console.error('RSS fetch failed:', error);
        throw error;
    }
}