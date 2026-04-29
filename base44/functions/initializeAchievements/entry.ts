import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
            return Response.json({ 
                error: 'Unauthorized - Admin access required' 
            }, { status: 403 });
        }

        console.log('🎮 Initializing achievements system...');

        const achievements = [
            // First-Time Achievements (Common)
            {
                name: 'Welcome Aboard!',
                description: 'Log into FBCA OS for the first time',
                icon: 'PartyPopper',
                category: 'special',
                points: 10,
                rarity: 'common',
                requirement_type: 'first_time',
                requirement_value: 1,
                badge_color: '#10b981',
                is_hidden: false
            },
            {
                name: 'Getting Connected',
                description: 'Connect your first integration',
                icon: 'Link',
                category: 'special',
                points: 25,
                rarity: 'common',
                requirement_type: 'integration',
                requirement_value: 1,
                badge_color: '#3b82f6',
                is_hidden: false
            },
            
            // Task Achievements
            {
                name: 'Getting Started',
                description: 'Complete your first 5 tasks',
                icon: 'CheckCircle2',
                category: 'tasks',
                points: 30,
                rarity: 'common',
                requirement_type: 'task_count',
                requirement_value: 5,
                badge_color: '#6366f1',
                is_hidden: false
            },
            {
                name: 'Task Warrior',
                description: 'Complete 25 tasks',
                icon: 'Target',
                category: 'tasks',
                points: 75,
                rarity: 'rare',
                requirement_type: 'task_count',
                requirement_value: 25,
                badge_color: '#8b5cf6',
                is_hidden: false
            },
            {
                name: 'Task Master',
                description: 'Complete 100 tasks',
                icon: 'Trophy',
                category: 'tasks',
                points: 150,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 100,
                badge_color: '#a855f7',
                is_hidden: false
            },
            {
                name: 'Lightning Fast',
                description: 'Complete 10 tasks in a single day',
                icon: 'Zap',
                category: 'speed',
                points: 100,
                rarity: 'epic',
                requirement_type: 'speed',
                requirement_value: 10,
                badge_color: '#eab308',
                is_hidden: false
            },
            {
                name: 'On Fire',
                description: 'Complete tasks 7 days in a row',
                icon: 'Flame',
                category: 'consistency',
                points: 100,
                rarity: 'epic',
                requirement_type: 'streak',
                requirement_value: 7,
                badge_color: '#f97316',
                is_hidden: false
            },
            {
                name: 'Perfectionist',
                description: 'Complete 50 tasks without missing a due date',
                icon: 'Award',
                category: 'tasks',
                points: 200,
                rarity: 'legendary',
                requirement_type: 'task_count',
                requirement_value: 50,
                badge_color: '#fbbf24',
                is_hidden: false
            },

            // Approval Achievements
            {
                name: 'Decision Maker',
                description: 'Process 10 approvals',
                icon: 'ClipboardCheck',
                category: 'approvals',
                points: 50,
                rarity: 'rare',
                requirement_type: 'approval_count',
                requirement_value: 10,
                badge_color: '#f59e0b',
                is_hidden: false
            },
            {
                name: 'Approval Expert',
                description: 'Process 50 approvals',
                icon: 'ShieldCheck',
                category: 'approvals',
                points: 125,
                rarity: 'epic',
                requirement_type: 'approval_count',
                requirement_value: 50,
                badge_color: '#d97706',
                is_hidden: false
            },
            {
                name: 'Gatekeeper',
                description: 'Process 100 approvals',
                icon: 'Crown',
                category: 'approvals',
                points: 200,
                rarity: 'legendary',
                requirement_type: 'approval_count',
                requirement_value: 100,
                badge_color: '#ea580c',
                is_hidden: false
            },

            // Event & Calendar Achievements
            {
                name: 'Event Starter',
                description: 'Attend 5 events',
                icon: 'Calendar',
                category: 'events',
                points: 40,
                rarity: 'common',
                requirement_type: 'event_attendance',
                requirement_value: 5,
                badge_color: '#06b6d4',
                is_hidden: false
            },
            {
                name: 'Meeting Maven',
                description: 'Attend 50 meetings',
                icon: 'Users',
                category: 'events',
                points: 100,
                rarity: 'epic',
                requirement_type: 'event_attendance',
                requirement_value: 50,
                badge_color: '#0891b2',
                is_hidden: false
            },
            {
                name: 'Party Planner',
                description: 'Create 25 events',
                icon: 'PartyPopper',
                category: 'events',
                points: 125,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 25,
                badge_color: '#ec4899',
                is_hidden: false
            },

            // Support Ticket Achievements
            {
                name: 'Problem Solver',
                description: 'Resolve 5 support tickets',
                icon: 'Wrench',
                category: 'collaboration',
                points: 50,
                rarity: 'rare',
                requirement_type: 'ticket_resolved',
                requirement_value: 5,
                badge_color: '#14b8a6',
                is_hidden: false
            },
            {
                name: 'Support Hero',
                description: 'Resolve 20 support tickets',
                icon: 'Heart',
                category: 'collaboration',
                points: 150,
                rarity: 'epic',
                requirement_type: 'ticket_resolved',
                requirement_value: 20,
                badge_color: '#06b6d4',
                is_hidden: false
            },

            // Email Management Achievements
            {
                name: 'Email Ninja',
                description: 'Process 50 categorized emails',
                icon: 'Mail',
                category: 'collaboration',
                points: 75,
                rarity: 'rare',
                requirement_type: 'task_count',
                requirement_value: 50,
                badge_color: '#3b82f6',
                is_hidden: false
            },
            {
                name: 'Inbox Zero Hero',
                description: 'Clear 100 emails from your action categories',
                icon: 'MailCheck',
                category: 'collaboration',
                points: 150,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 100,
                badge_color: '#2563eb',
                is_hidden: false
            },

            // Integration Achievements
            {
                name: 'Connected',
                description: 'Connect all 3 integrations (PCO, ClickUp, Microsoft)',
                icon: 'Plug',
                category: 'special',
                points: 100,
                rarity: 'epic',
                requirement_type: 'integration',
                requirement_value: 3,
                badge_color: '#8b5cf6',
                is_hidden: false
            },
            {
                name: 'Integration Master',
                description: 'Use all integrations for 30 days',
                icon: 'Sparkles',
                category: 'special',
                points: 200,
                rarity: 'legendary',
                requirement_type: 'integration',
                requirement_value: 30,
                badge_color: '#7c3aed',
                is_hidden: false
            },

            // FBCA-Specific Achievements
            {
                name: 'Ministry Leader',
                description: 'Manage 10 PCO events',
                icon: 'Church',
                category: 'exploration',
                points: 100,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 10,
                badge_color: '#6366f1',
                is_hidden: false
            },
            {
                name: 'AV Master',
                description: 'Set up 20 production events',
                icon: 'Mic2',
                category: 'exploration',
                points: 150,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 20,
                badge_color: '#8b5cf6',
                is_hidden: false
            },
            {
                name: 'Communications Champion',
                description: 'Submit 10 marketing requests',
                icon: 'MessageSquare',
                category: 'collaboration',
                points: 100,
                rarity: 'rare',
                requirement_type: 'task_count',
                requirement_value: 10,
                badge_color: '#ec4899',
                is_hidden: false
            },
            {
                name: 'Hospitality Hero',
                description: 'Fulfill 15 catering requests',
                icon: 'UtensilsCrossed',
                category: 'collaboration',
                points: 125,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 15,
                badge_color: '#10b981',
                is_hidden: false
            },
            {
                name: 'Access Manager',
                description: 'Distribute 50 door codes',
                icon: 'Key',
                category: 'approvals',
                points: 150,
                rarity: 'epic',
                requirement_type: 'approval_count',
                requirement_value: 50,
                badge_color: '#f59e0b',
                is_hidden: false
            },

            // Community & Team Achievements
            {
                name: 'Team Player',
                description: 'Collaborate on 10 shared tasks or approvals',
                icon: 'Users',
                category: 'collaboration',
                points: 75,
                rarity: 'rare',
                requirement_type: 'task_count',
                requirement_value: 10,
                badge_color: '#06b6d4',
                is_hidden: false
            },
            {
                name: 'Department Champion',
                description: 'Complete 50 department-specific tasks',
                icon: 'Building2',
                category: 'collaboration',
                points: 150,
                rarity: 'epic',
                requirement_type: 'task_count',
                requirement_value: 50,
                badge_color: '#6366f1',
                is_hidden: false
            },

            // Hidden/Secret Achievements
            {
                name: 'Night Owl',
                description: 'Log in after midnight 10 times',
                icon: 'Moon',
                category: 'special',
                points: 50,
                rarity: 'rare',
                requirement_type: 'first_time',
                requirement_value: 10,
                badge_color: '#6366f1',
                is_hidden: true
            },
            {
                name: 'Early Bird',
                description: 'Log in before 6 AM 10 times',
                icon: 'Sunrise',
                category: 'special',
                points: 50,
                rarity: 'rare',
                requirement_type: 'first_time',
                requirement_value: 10,
                badge_color: '#f59e0b',
                is_hidden: true
            },
            {
                name: 'Weekend Warrior',
                description: 'Complete tasks on 5 weekends',
                icon: 'Briefcase',
                category: 'special',
                points: 75,
                rarity: 'rare',
                requirement_type: 'streak',
                requirement_value: 5,
                badge_color: '#8b5cf6',
                is_hidden: true
            },
            {
                name: 'Explorer',
                description: 'Visit every page in FBCA OS',
                icon: 'Compass',
                category: 'exploration',
                points: 100,
                rarity: 'epic',
                requirement_type: 'first_time',
                requirement_value: 15,
                badge_color: '#06b6d4',
                is_hidden: true
            },
            {
                name: 'Power User',
                description: 'Use FBCA OS for 30 consecutive days',
                icon: 'Zap',
                category: 'consistency',
                points: 200,
                rarity: 'legendary',
                requirement_type: 'streak',
                requirement_value: 30,
                badge_color: '#eab308',
                is_hidden: true
            }
        ];

        console.log(`📝 Creating ${achievements.length} achievements...`);

        const created = [];
        for (const achievement of achievements) {
            try {
                const existing = await base44.asServiceRole.entities.Achievement.filter({
                    name: achievement.name
                });

                if (existing && existing.length > 0) {
                    console.log(`⏭️ Achievement "${achievement.name}" already exists, skipping...`);
                    continue;
                }

                const newAchievement = await base44.asServiceRole.entities.Achievement.create(achievement);
                created.push(newAchievement);
                console.log(`✅ Created: ${achievement.name}`);
            } catch (error) {
                console.error(`❌ Failed to create "${achievement.name}":`, error.message);
            }
        }

        console.log(`\n🎉 Successfully created ${created.length} new achievements!`);

        return Response.json({
            success: true,
            message: `Created ${created.length} achievements`,
            total_achievements: achievements.length,
            created: created.length,
            breakdown: {
                common: achievements.filter(a => a.rarity === 'common').length,
                rare: achievements.filter(a => a.rarity === 'rare').length,
                epic: achievements.filter(a => a.rarity === 'epic').length,
                legendary: achievements.filter(a => a.rarity === 'legendary').length,
                hidden: achievements.filter(a => a.is_hidden).length
            }
        });

    } catch (error) {
        console.error('❌ Error initializing achievements:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});