import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // FBCA has 6 Transistor.fm podcast feeds
        const podcasts = [
            {
                id: 1,
                title: 'FBCA Sermons',
                description: 'Weekly messages from Pastor Dennis Wiles',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/podcasts2022.png',
                feedUrl: 'https://fbcasermons.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/first-baptist-church-arlington-sermons/playlist',
                episodes: 0
            },
            {
                id: 2,
                title: 'Tell Me More',
                description: 'Your midweek spiritual boost - unpacking Sunday\'s sermon',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/Podcasts_TellMeMore.png',
                feedUrl: 'https://tellmemore.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/tell-me-more/playlist',
                episodes: 0
            },
            {
                id: 3,
                title: 'It Takes A Village',
                description: 'Insights for parents guiding middle and high schoolers',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/Podcasts_ItTakesAVillage.png',
                feedUrl: 'https://ittakesavillage.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/it-takes-a-village/playlist',
                episodes: 0
            },
            {
                id: 4,
                title: 'Small Steps',
                description: 'Faith-filled encouragement for young families',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/Podcasts_SmallSteps.png',
                feedUrl: 'https://smallsteps.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/small-steps/playlist',
                episodes: 0
            },
            {
                id: 5,
                title: 'Live Sent',
                description: 'Living missionally in Arlington and beyond',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/Podcasts_LiveSent.png',
                feedUrl: 'https://livesent.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/live-sent/playlist',
                episodes: 0
            },
            {
                id: 6,
                title: 'Family Talk Box',
                description: 'Building stronger family connections through conversation',
                thumbnail: 'https://www.fbca.org/wp-content/uploads/2022/09/Podcasts_FamilyTalkBox.png',
                feedUrl: 'https://familytalkbox.transistor.fm/',
                embedUrl: 'https://share.transistor.fm/e/family-talk-box/playlist',
                episodes: 0
            }
        ];

        return Response.json({
            success: true,
            podcasts,
            featured: podcasts.slice(0, 2) // FBCA Sermons and Tell Me More are featured
        });

    } catch (error) {
        console.error('Error fetching FBCA podcasts:', error);
        return Response.json({
            error: 'Failed to fetch FBCA podcasts',
            details: error.message
        }, { status: 500 });
    }
});