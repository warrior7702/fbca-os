import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.clickup_access_token) {
            return Response.json({ error: 'ClickUp not connected' }, { status: 400 });
        }

        // Get authorized user info
        const userResponse = await fetch('https://api.clickup.com/api/v2/user', {
            headers: {
                'Authorization': user.clickup_access_token
            }
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error('ClickUp API error:', errorText);
            return Response.json({ error: 'Failed to fetch ClickUp data' }, { status: 500 });
        }

        const userData = await userResponse.json();

        // Get teams/workspaces
        const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
            headers: {
                'Authorization': user.clickup_access_token
            }
        });

        let teams = [];
        if (teamsResponse.ok) {
            const teamsData = await teamsResponse.json();
            teams = teamsData.teams.map(team => ({
                id: team.id,
                name: team.name
            }));
        }

        return Response.json({
            success: true,
            user: userData.user,
            teams: teams
        });

    } catch (error) {
        console.error('Test ClickUp error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});