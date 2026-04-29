import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🎙️ ========== FETCHING FBCA PODCASTS ==========');

        const transistorUrl = 'https://fbcasermons.transistor.fm/';
        console.log('🌐 Fetching:', transistorUrl);
        
        const response = await fetch(transistorUrl);
        const html = await response.text();
        
        console.log('📄 HTML received, length:', html.length);

        const podcasts = [];

        // Strategy: Find all podcast show links
        // Transistor typically has links like /s/show-name
        const showLinkRegex = /href="(\/s\/[^"]+)"/gi;
        const showLinks = new Set();
        
        let match;
        while ((match = showLinkRegex.exec(html)) !== null) {
            showLinks.add(match[1]);
        }
        
        console.log(`🔍 Found ${showLinks.size} unique podcast shows`);

        for (const showPath of Array.from(showLinks)) {
            try {
                const showUrl = `https://fbcasermons.transistor.fm${showPath}`;
                console.log(`\n🎧 Fetching show: ${showUrl}`);
                
                const showResponse = await fetch(showUrl);
                const showHtml = await showResponse.text();
                
                // Get show title
                const titleMatch = showHtml.match(/<title>([^<]+)<\/title>/i);
                let title = titleMatch ? titleMatch[1].replace(' | FBCA Sermons', '').trim() : 'FBCA Podcast';
                
                // Get show description from meta tag
                const descMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
                const description = descMatch ? descMatch[1] : 'FBCA Sermons and Messages';
                
                // Get thumbnail/cover image
                const imageMatch = showHtml.match(/<meta\s+(?:name|property)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
                const thumbnail = imageMatch ? imageMatch[1] : 'https://images.transistor.fm/file/transistor/images/logos/site/20532/x1000.png';
                
                // Get RSS feed link
                const rssFeedMatch = showHtml.match(/href=["']([^"']*feeds\.transistor\.fm[^"']*)["']/i);
                const feedUrl = rssFeedMatch ? rssFeedMatch[1] : showUrl;
                
                console.log(`  📝 Title: ${title}`);
                console.log(`  📝 Description: ${description.substring(0, 50)}...`);
                console.log(`  🖼️ Thumbnail: ${thumbnail}`);
                console.log(`  📡 Feed: ${feedUrl}`);
                
                podcasts.push({
                    id: showPath.replace('/s/', ''),
                    title: title,
                    description: description,
                    thumbnail: thumbnail,
                    feedUrl: feedUrl,
                    showUrl: showUrl
                });
                
                console.log(`  ✅ Added podcast: ${title}`);
                
            } catch (showError) {
                console.error(`❌ Error fetching show ${showPath}:`, showError.message);
            }
        }

        console.log('\n✅ ========== PODCAST FETCH SUCCESS ==========');
        console.log(`📊 Total Podcasts: ${podcasts.length}`);
        
        if (podcasts.length > 0) {
            console.log('\n🎙️ Podcasts found:');
            podcasts.forEach(podcast => {
                console.log(`   - ${podcast.title}`);
            });
        }

        return Response.json({
            success: true,
            podcasts: podcasts,
            count: podcasts.length
        });

    } catch (error) {
        console.error('\n❌ ========== PODCAST FETCH ERROR ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        return Response.json({
            success: false,
            error: 'Failed to fetch podcasts',
            details: error.message,
            podcasts: []
        }, { status: 500 });
    }
});