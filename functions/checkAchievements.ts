import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user_email } = await req.json();
        const email = user_email || user.email;

        console.log('🏆 Checking achievements for:', email);

        // Get all achievements
        const achievements = await base44.asServiceRole.entities.Achievement.list();
        
        // Get user's current progress
        const userAchievements = await base44.asServiceRole.entities.UserAchievement.filter({
            user_email: email
        });

        const newlyUnlocked = [];

        for (const achievement of achievements) {
            let userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
            
            // Create progress record if it doesn't exist
            if (!userAchievement) {
                userAchievement = await base44.asServiceRole.entities.UserAchievement.create({
                    user_email: email,
                    achievement_id: achievement.id,
                    progress: 0,
                    unlocked: false
                });
            }

            // Skip if already unlocked
            if (userAchievement.unlocked) continue;

            // Calculate current progress based on requirement type
            let currentProgress = 0;
            
            try {
                switch (achievement.requirement_type) {
                    case 'task_count':
                        // Count completed ClickUp tasks
                        try {
                            const clickupResponse = await base44.functions.invoke('getMyClickUpTasks');
                            const tasks = clickupResponse.data?.tasks || [];
                            currentProgress = tasks.filter(t => t.status?.toLowerCase().includes('complete')).length;
                        } catch (error) {
                            console.log('Could not fetch ClickUp tasks:', error.message);
                        }
                        break;

                    case 'approval_count':
                        // Count approvals given
                        try {
                            const approvalsResponse = await base44.functions.invoke('getMyPendingApprovals');
                            // This would need to track historical approvals, for now just count pending
                            currentProgress = approvalsResponse.data?.count || 0;
                        } catch (error) {
                            console.log('Could not fetch approvals:', error.message);
                        }
                        break;

                    case 'event_attendance':
                        // Count PCO events attended
                        try {
                            const scheduleResponse = await base44.functions.invoke('getMySchedule');
                            const events = scheduleResponse.data?.events || [];
                            // Count past events
                            currentProgress = events.filter(e => new Date(e.ends_at) < new Date()).length;
                        } catch (error) {
                            console.log('Could not fetch schedule:', error.message);
                        }
                        break;

                    case 'ticket_resolved':
                        // Count resolved support tickets
                        const tickets = await base44.asServiceRole.entities.Ticket.filter({
                            assigned_to: email,
                            status: { $in: ['resolved', 'closed'] }
                        });
                        currentProgress = tickets.length;
                        break;

                    case 'first_time':
                        // Check for first-time actions (login, task, etc.)
                        currentProgress = 1; // Always unlock first-time achievements
                        break;

                    case 'integration':
                        // Count connected integrations
                        const userData = await base44.auth.me();
                        let integrationCount = 0;
                        if (userData.pco_access_token) integrationCount++;
                        if (userData.clickup_access_token) integrationCount++;
                        if (userData.microsoft_access_token) integrationCount++;
                        currentProgress = integrationCount;
                        break;

                    default:
                        currentProgress = userAchievement.progress;
                }

                // Update progress
                await base44.asServiceRole.entities.UserAchievement.update(userAchievement.id, {
                    progress: currentProgress
                });

                // Check if achievement is unlocked
                if (currentProgress >= achievement.requirement_value && !userAchievement.unlocked) {
                    await base44.asServiceRole.entities.UserAchievement.update(userAchievement.id, {
                        unlocked: true,
                        unlocked_at: new Date().toISOString()
                    });
                    
                    newlyUnlocked.push(achievement);
                    console.log(`✅ Unlocked: ${achievement.name}`);
                }

            } catch (error) {
                console.error(`Error checking achievement ${achievement.name}:`, error.message);
            }
        }

        return Response.json({
            success: true,
            checked: achievements.length,
            newlyUnlocked: newlyUnlocked
        });

    } catch (error) {
        console.error('Error checking achievements:', error);
        return Response.json({
            error: 'Failed to check achievements',
            details: error.message
        }, { status: 500 });
    }
});