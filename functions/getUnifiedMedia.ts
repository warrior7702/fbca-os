import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🎬 ========== UNIFIED MEDIA AGGREGATOR ==========');

        const allMedia = {
            sermons: [],
            livestream: null,
            videos: [],
            podcasts: []
        };

        // 1. Fetch YouTube content
        console.log('\n📺 === FETCHING YOUTUBE CONTENT ===');
        try {
            const youtubeChannelId = 'UCnXo8yLYZYwWEOQ-OqQcJFw'; // @FirstBaptistArlington
            
            // YouTube RSS feeds (no API key needed!)
            const youtubeFeeds = [
                { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`, type: 'videos' },
            ];

            for (const feed of youtubeFeeds) {
                try {
                    const response = await fetch(feed.url);
                    const xmlText = await response.text();
                    
                    // Parse XML for video entries
                    const videoMatches = xmlText.matchAll(/<entry>(.*?)<\/entry>/gs);
                    
                    for (const match of videoMatches) {
                        const entry = match[1];
                        
                        const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
                        const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
                        const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
                        
                        if (videoIdMatch && titleMatch) {
                            const videoId = videoIdMatch[1];
                            const title = titleMatch[1];
                            const published = publishedMatch ? new Date(publishedMatch[1]) : null;
                            
                            const video = {
                                id: `yt-${videoId}`,
                                title: title,
                                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                                videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                                embedUrl: `https://www.youtube.com/embed/${videoId}`,
                                date: published ? published.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
                                source: 'youtube',
                                type: feed.type
                            };
                            
                            // Categorize based on title keywords
                            const titleLower = title.toLowerCase();
                            if (titleLower.includes('sermon') || titleLower.includes('message') || titleLower.includes('worship service')) {
                                allMedia.sermons.push(video);
                            } else {
                                allMedia.videos.push(video);
                            }
                        }
                    }
                    
                    console.log(`✅ Fetched ${feed.type} from YouTube`);
                } catch (feedError) {
                    console.error(`❌ YouTube ${feed.type} error:`, feedError.message);
                }
            }
        } catch (ytError) {
            console.error('❌ YouTube fetch error:', ytError.message);
        }

        // 2. Fetch Planning Center media
        console.log('\n⛪ === FETCHING PLANNING CENTER MEDIA ===');
        try {
            const pcoResponse = await fetch('https://fbca.churchcenter.com/pages/media');
            const pcoHtml = await pcoResponse.text();
            
            // Look for video embeds or links
            const videoMatches = pcoHtml.matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g);
            const foundVideos = new Set();
            
            for (const match of videoMatches) {
                const videoId = match[1];
                if (!foundVideos.has(videoId)) {
                    foundVideos.add(videoId);
                    
                    allMedia.videos.push({
                        id: `pco-${videoId}`,
                        title: 'FBCA Media',
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        embedUrl: `https://www.youtube.com/embed/${videoId}`,
                        source: 'planning_center'
                    });
                }
            }
            
            console.log(`✅ Found ${foundVideos.size} videos from Planning Center`);
        } catch (pcoError) {
            console.error('❌ Planning Center error:', pcoError.message);
        }

        // 3. Fetch FBCA.org sermons
        console.log('\n🎤 === FETCHING FBCA.ORG SERMONS ===');
        try {
            const sermonsResponse = await fetch('https://www.fbca.org/sermons/');
            const sermonsHtml = await sermonsResponse.text();
            
            // Look for sermon links and embeds
            const sermonMatches = sermonsHtml.matchAll(/href="([^"]*sermons[^"]*)"/gi);
            
            for (const match of sermonMatches) {
                const url = match[1];
                if (url && !url.includes('#') && !url.includes('javascript')) {
                    const fullUrl = url.startsWith('http') ? url : `https://www.fbca.org${url}`;
                    
                    // Try to get title from nearby text
                    const index = sermonsHtml.indexOf(url);
                    const section = sermonsHtml.substring(Math.max(0, index - 200), index + 200);
                    const titleMatch = section.match(/<[^>]*>([^<]{10,})<\/[^>]*>/);
                    
                    allMedia.sermons.push({
                        id: `sermon-${url.split('/').pop()}`,
                        title: titleMatch ? titleMatch[1].trim() : 'FBCA Sermon',
                        videoUrl: fullUrl,
                        source: 'fbca_org'
                    });
                }
            }
            
            console.log(`✅ Found ${allMedia.sermons.length} sermons from FBCA.org`);
        } catch (sermonsError) {
            console.error('❌ FBCA.org sermons error:', sermonsError.message);
        }

        // 4. Fetch Resi media
        console.log('\n📹 === FETCHING RESI MEDIA ===');
        try {
            const resiResponse = await fetch('https://sites.resi.io/fbcamedia');
            const resiHtml = await resiResponse.text();
            
            // Look for Resi video players
            const resiMatches = resiHtml.matchAll(/href="(\/fbcamedia\/watch\/[^"]+)"/gi);
            
            for (const match of resiMatches) {
                const videoPath = match[1];
                const videoId = videoPath.split('/').pop();
                
                allMedia.videos.push({
                    id: `resi-${videoId}`,
                    title: 'FBCA Video',
                    videoUrl: `https://sites.resi.io${videoPath}`,
                    embedUrl: `https://sites.resi.io${videoPath}`,
                    source: 'resi'
                });
            }
            
            console.log(`✅ Found ${allMedia.videos.length} videos from Resi`);
        } catch (resiError) {
            console.error('❌ Resi error:', resiError.message);
        }

        // 5. Fetch Transistor podcasts
        console.log('\n🎙️ === FETCHING PODCASTS ===');
        try {
            const transistorResponse = await fetch('https://fbcasermons.transistor.fm/');
            const transistorHtml = await transistorResponse.text();
            
            const showLinkRegex = /href="(\/s\/[^"]+)"/gi;
            const showLinks = new Set();
            
            let match;
            while ((match = showLinkRegex.exec(transistorHtml)) !== null) {
                showLinks.add(match[1]);
            }
            
            for (const showPath of Array.from(showLinks).slice(0, 10)) {
                try {
                    const showUrl = `https://fbcasermons.transistor.fm${showPath}`;
                    const showResponse = await fetch(showUrl);
                    const showHtml = await showResponse.text();
                    
                    const titleMatch = showHtml.match(/<title>([^<]+)<\/title>/i);
                    const descMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
                    const imageMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
                    const rssFeedMatch = showHtml.match(/href=["']([^"']*feeds\.transistor\.fm[^"']*)["']/i);
                    
                    allMedia.podcasts.push({
                        id: showPath.replace('/s/', ''),
                        title: titleMatch ? titleMatch[1].replace(' | FBCA Sermons', '').trim() : 'FBCA Podcast',
                        description: descMatch ? descMatch[1] : 'FBCA Sermons and Messages',
                        thumbnail: imageMatch ? imageMatch[1] : 'https://images.transistor.fm/file/transistor/images/logos/site/20532/x1000.png',
                        feedUrl: rssFeedMatch ? rssFeedMatch[1] : showUrl,
                        showUrl: showUrl,
                        source: 'transistor'
                    });
                } catch (showError) {
                    console.error(`❌ Podcast show error:`, showError.message);
                }
            }
            
            console.log(`✅ Found ${allMedia.podcasts.length} podcasts`);
        } catch (podcastError) {
            console.error('❌ Podcast error:', podcastError.message);
        }

        // 6. Check live stream status
        console.log('\n📡 === CHECKING LIVE STREAM ===');
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentMinutes = hour * 60 + minute;

        const sundayMorning1Start = 540 - 15;
        const sundayMorning1End = 540 + 75;
        const sundayMorning2Start = 645 - 15;
        const sundayMorning2End = 645 + 75;
        const wednesdayEveningStart = 1110 - 15;
        const wednesdayEveningEnd = 1110 + 90;

        let isLive = false;
        if (day === 0) {
            isLive = (currentMinutes >= sundayMorning1Start && currentMinutes <= sundayMorning1End) ||
                     (currentMinutes >= sundayMorning2Start && currentMinutes <= sundayMorning2End);
        } else if (day === 3) {
            isLive = currentMinutes >= wednesdayEveningStart && currentMinutes <= wednesdayEveningEnd;
        }

        allMedia.livestream = {
            isLive: isLive,
            url: 'https://www.fbca.org/watch-listen/live/',
            embedUrl: 'https://www.fbca.org/watch-listen/live/',
            title: isLive ? 'Live Now!' : 'Watch Live',
            schedule: {
                sunday_morning_1: '9:00 AM',
                sunday_morning_2: '10:45 AM',
                wednesday_evening: '6:30 PM'
            }
        };

        console.log(`✅ Live stream status: ${isLive ? 'LIVE' : 'Offline'}`);

        // Remove duplicates and sort
        allMedia.sermons = removeDuplicates(allMedia.sermons);
        allMedia.videos = removeDuplicates(allMedia.videos);
        allMedia.podcasts = removeDuplicates(allMedia.podcasts);

        // Sort by date (newest first)
        allMedia.sermons.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date) - new Date(a.date);
        });
        
        allMedia.videos.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date) - new Date(a.date);
        });

        const stats = {
            totalSermons: allMedia.sermons.length,
            totalVideos: allMedia.videos.length,
            totalPodcasts: allMedia.podcasts.length,
            isLive: allMedia.livestream.isLive
        };

        console.log('\n✅ ========== AGGREGATION SUCCESS ==========');
        console.log(`📊 Sermons: ${stats.totalSermons}`);
        console.log(`📊 Videos: ${stats.totalVideos}`);
        console.log(`📊 Podcasts: ${stats.totalPodcasts}`);
        console.log(`📡 Live: ${stats.isLive ? 'YES' : 'NO'}`);

        return Response.json({
            success: true,
            media: allMedia,
            stats: stats,
            featured: allMedia.sermons[0] || allMedia.videos[0] || null
        });

    } catch (error) {
        console.error('\n❌ ========== AGGREGATION ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to aggregate media',
            details: error.message,
            media: { sermons: [], videos: [], podcasts: [], livestream: null },
            stats: { totalSermons: 0, totalVideos: 0, totalPodcasts: 0, isLive: false }
        }, { status: 500 });
    }
});

function removeDuplicates(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = item.videoUrl || item.feedUrl || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}