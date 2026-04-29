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

        // 1. Fetch YouTube content via RSS (works without API key!)
        console.log('\n📺 === FETCHING YOUTUBE CONTENT ===');
        try {
            const youtubeChannelId = 'UCnXo8yLYZYwWEOQ-OqQcJFw'; // @FirstBaptistArlington
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`;
            
            console.log('📡 Fetching YouTube RSS:', rssUrl);
            const response = await fetch(rssUrl);
            const xmlText = await response.text();
            
            console.log('✅ YouTube RSS received');
            
            // Parse XML for video entries
            const videoMatches = xmlText.matchAll(/<entry>(.*?)<\/entry>/gs);
            let videoCount = 0;
            
            for (const match of videoMatches) {
                const entry = match[1];
                
                const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
                const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
                const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
                const descriptionMatch = entry.match(/<media:description>([^<]*)<\/media:description>/);
                
                if (videoIdMatch && titleMatch) {
                    const videoId = videoIdMatch[1];
                    const title = titleMatch[1];
                    const published = publishedMatch ? new Date(publishedMatch[1]) : null;
                    const description = descriptionMatch ? descriptionMatch[1] : '';
                    
                    const video = {
                        id: `yt-${videoId}`,
                        title: title,
                        description: description,
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        embedUrl: `https://www.youtube.com/embed/${videoId}`,
                        date: published ? published.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
                        publishedDate: published,
                        source: 'youtube'
                    };
                    
                    // Categorize based on title keywords
                    const titleLower = title.toLowerCase();
                    if (titleLower.includes('sermon') || 
                        titleLower.includes('message') || 
                        titleLower.includes('worship service') ||
                        titleLower.includes('sunday') ||
                        titleLower.includes('pastor') ||
                        titleLower.includes('dr.') ||
                        titleLower.includes('rev.')) {
                        allMedia.sermons.push(video);
                    } else {
                        allMedia.videos.push(video);
                    }
                    
                    videoCount++;
                }
            }
            
            console.log(`✅ Parsed ${videoCount} videos from YouTube RSS`);
            console.log(`   - Sermons: ${allMedia.sermons.length}`);
            console.log(`   - Other Videos: ${allMedia.videos.length}`);
            
        } catch (ytError) {
            console.error('❌ YouTube fetch error:', ytError.message);
        }

        // 2. Fetch Transistor podcasts
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
            
            console.log(`🔍 Found ${showLinks.size} podcast shows`);
            
            for (const showPath of Array.from(showLinks).slice(0, 10)) {
                try {
                    const showUrl = `https://fbcasermons.transistor.fm${showPath}`;
                    const showResponse = await fetch(showUrl);
                    const showHtml = await showResponse.text();
                    
                    const titleMatch = showHtml.match(/<title>([^<]+)<\/title>/i);
                    const descMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
                    const imageMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
                    const rssFeedMatch = showHtml.match(/href=["']([^"']*feeds\.transistor\.fm[^"']*)["']/i);
                    
                    const podcast = {
                        id: showPath.replace('/s/', ''),
                        title: titleMatch ? titleMatch[1].replace(' | FBCA Sermons', '').trim() : 'FBCA Podcast',
                        description: descMatch ? descMatch[1] : 'FBCA Sermons and Messages',
                        thumbnail: imageMatch ? imageMatch[1] : 'https://images.transistor.fm/file/transistor/images/logos/site/20532/x1000.png',
                        feedUrl: rssFeedMatch ? rssFeedMatch[1] : showUrl,
                        showUrl: showUrl,
                        source: 'transistor'
                    };
                    
                    allMedia.podcasts.push(podcast);
                    console.log(`  ✅ Added: ${podcast.title}`);
                    
                } catch (showError) {
                    console.error(`❌ Podcast show error:`, showError.message);
                }
            }
            
            console.log(`✅ Total podcasts found: ${allMedia.podcasts.length}`);
            
        } catch (podcastError) {
            console.error('❌ Podcast error:', podcastError.message);
        }

        // 3. Try to get Planning Center videos
        console.log('\n⛪ === CHECKING PLANNING CENTER ===');
        try {
            const pcoResponse = await fetch('https://fbca.churchcenter.com/pages/media');
            const pcoHtml = await pcoResponse.text();
            
            // Look for embedded YouTube videos
            const youtubeMatches = pcoHtml.matchAll(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g);
            const foundVideos = new Set();
            
            for (const match of youtubeMatches) {
                const videoId = match[1];
                if (!foundVideos.has(videoId)) {
                    foundVideos.add(videoId);
                    
                    // Check if we already have this video from YouTube RSS
                    const existing = allMedia.sermons.find(v => v.id === `yt-${videoId}`) ||
                                   allMedia.videos.find(v => v.id === `yt-${videoId}`);
                    
                    if (!existing) {
                        allMedia.videos.push({
                            id: `pco-${videoId}`,
                            title: 'FBCA Media',
                            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                            embedUrl: `https://www.youtube.com/embed/${videoId}`,
                            source: 'planning_center'
                        });
                    }
                }
            }
            
            console.log(`✅ Found ${foundVideos.size} videos from Planning Center (${foundVideos.size === 0 ? 'may already be in YouTube feed' : 'added unique ones'})`);
            
        } catch (pcoError) {
            console.error('❌ Planning Center error:', pcoError.message);
        }

        // 4. Check live stream status
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

        // Remove duplicates based on video URL
        allMedia.sermons = removeDuplicatesByUrl(allMedia.sermons);
        allMedia.videos = removeDuplicatesByUrl(allMedia.videos);
        allMedia.podcasts = removeDuplicatesByUrl(allMedia.podcasts);

        // Sort by date (newest first)
        allMedia.sermons.sort((a, b) => {
            if (!a.publishedDate) return 1;
            if (!b.publishedDate) return -1;
            return b.publishedDate - a.publishedDate;
        });
        
        allMedia.videos.sort((a, b) => {
            if (!a.publishedDate) return 1;
            if (!b.publishedDate) return -1;
            return b.publishedDate - a.publishedDate;
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

function removeDuplicatesByUrl(items) {
    const seen = new Map();
    return items.filter(item => {
        const key = item.videoUrl || item.feedUrl || item.id;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}