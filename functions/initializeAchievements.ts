import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('🏆 Initializing achievements system...');

        // Define starter achievements
        const starterAchievements = [
            // First-time achievements
            {
                name: "Welcome Aboard!",
                description: "Complete your first login to FBCA OS",
                icon: "Sparkles",
                category: "special",
                points: 10,
                rarity: "common",
                requirement_type: "first_time",
                requirement_value: 1,
                badge_color: "#3b82f6"
            },
            {
                name: "Getting Connected",
                description: "Connect your first integration",
                icon: "Zap",
                category: "exploration",
                points: 25,
                rarity: "common",
                requirement_type: "integration",
                requirement_value: 1,
                badge_color: "#8b5cf6"
            },
            {
                name: "Fully Integrated",
                description: "Connect all three integrations (PCO, ClickUp, Microsoft)",
                icon: "Crown",
                category: "exploration",
                points: 100,
                rarity: "epic",
                requirement_type: "integration",
                requirement_value: 3,
                badge_color: "#f59e0b"
            },

            // Task achievements
            {
                name: "Task Rookie",
                description: "Complete your first 5 tasks",
                icon: "ListChecks",
                category: "tasks",
                points: 20,
                rarity: "common",
                requirement_type: "task_count",
                requirement_value: 5,
                badge_color: "#10b981"
            },
            {
                name: "Task Master",
                description: "Complete 25 tasks",
                icon: "Target",
                category: "tasks",
                points: 50,
                rarity: "rare",
                requirement_type: "task_count",
                requirement_value: 25,
                badge_color: "#3b82f6"
            },
            {
                name: "Task Legendary",
                description: "Complete 100 tasks",
                icon: "Trophy",
                category: "tasks",
                points: 200,
                rarity: "legendary",
                requirement_type: "task_count",
                requirement_value: 100,
                badge_color: "#f59e0b"
            },

            // Approval achievements
            {
                name: "Approval Novice",
                description: "Process 10 approvals",
                icon: "ClipboardCheck",
                category: "approvals",
                points: 30,
                rarity: "common",
                requirement_type: "approval_count",
                requirement_value: 10,
                badge_color: "#ef4444"
            },
            {
                name: "Quick Decider",
                description: "Process 50 approvals",
                icon: "Zap",
                category: "approvals",
                points: 75,
                rarity: "rare",
                requirement_type: "approval_count",
                requirement_value: 50,
                badge_color: "#f97316"
            },

            // Event achievements
            {
                name: "Church Regular",
                description: "Attend 5 scheduled events",
                icon: "Calendar",
                category: "events",
                points: 40,
                rarity: "common",
                requirement_type: "event_attendance",
                requirement_value: 5,
                badge_color: "#6366f1"
            },
            {
                name: "Devoted Servant",
                description: "Attend 25 scheduled events",
                icon: "Star",
                category: "events",
                points: 100,
                rarity: "rare",
                requirement_type: "event_attendance",
                requirement_value: 25,
                badge_color: "#8b5cf6"
            },

            // Collaboration achievements
            {
                name: "Team Player",
                description: "Resolve 5 support tickets",
                icon: "Users",
                category: "collaboration",
                points: 50,
                rarity: "rare",
                requirement_type: "ticket_resolved",
                requirement_value: 5,
                badge_color: "#14b8a6"
            },
            {
                name: "Support Hero",
                description: "Resolve 20 support tickets",
                icon: "Award",
                category: "collaboration",
                points: 150,
                rarity: "epic",
                requirement_type: "ticket_resolved",
                requirement_value: 20,
                badge_color: "#06b6d4"
            },

            // Speed achievements
            {
                name: "Speed Demon",
                description: "Complete 10 tasks in a single day",
                icon: "Flame",
                category: "speed",
                points: 75,
                rarity: "epic",
                requirement_type: "task_count",
                requirement_value: 10,
                badge_color: "#dc2626",
                is_hidden: true
            },

            // Special/Hidden achievements
            {
                name: "Early Bird",
                description: "Complete a task before 7 AM",
                icon: "TrendingUp",
                category: "special",
                points: 50,
                rarity: "rare",
                requirement_type: "first_time",
                requirement_value: 1,
                badge_color: "#fbbf24",
                is_hidden: true
            },
            {
                name: "Night Owl",
                description: "Complete a task after 10 PM",
                icon: "Moon",
                category: "special",
                points: 50,
                rarity: "rare",
                requirement_type: "first_time",
                requirement_value: 1,
                badge_color: "#4f46e5",
                is_hidden: true
            }
        ];

        // Check if achievements already exist
        const existing = await base44.asServiceRole.entities.Achievement.list();
        
        if (existing.length > 0) {
            console.log(`⚠️ ${existing.length} achievements already exist. Skipping initialization.`);
            return Response.json({
                success: true,
                message: 'Achievements already initialized',
                count: existing.length
            });
        }

        // Create achievements
        const created = [];
        for (const achievement of starterAchievements) {
            const result = await base44.asServiceRole.entities.Achievement.create(achievement);
            created.push(result);
            console.log(`✅ Created: ${achievement.name}`);
        }

        console.log(`🎉 Created ${created.length} achievements!`);

        return Response.json({
            success: true,
            created: created.length,
            achievements: created
        });

    } catch (error) {
        console.error('Error initializing achievements:', error);
        return Response.json({
            error: 'Failed to initialize achievements',
            details: error.message
        }, { status: 500 });
    }
});