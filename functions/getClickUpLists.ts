import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Get teams/workspaces
    const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { 'Authorization': user.clickup_access_token }
    });

    if (!teamsResponse.ok) {
      return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }

    const teamsData = await teamsResponse.json();
    const teams = teamsData.teams || [];

    const allLists = [];

    // Get spaces and lists for each team
    for (const team of teams) {
      const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${team.id}/space`, {
        headers: { 'Authorization': user.clickup_access_token }
      });

      if (!spacesResponse.ok) continue;

      const spacesData = await spacesResponse.json();
      const spaces = spacesData.spaces || [];

      for (const space of spaces) {
        // Get folders in space
        const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder`, {
          headers: { 'Authorization': user.clickup_access_token }
        });

        if (foldersResponse.ok) {
          const foldersData = await foldersResponse.json();
          const folders = foldersData.folders || [];

          for (const folder of folders) {
            // Get lists in folder
            const listsResponse = await fetch(`https://api.clickup.com/api/v2/folder/${folder.id}/list`, {
              headers: { 'Authorization': user.clickup_access_token }
            });

            if (listsResponse.ok) {
              const listsData = await listsResponse.json();
              const lists = listsData.lists || [];

              for (const list of lists) {
                allLists.push({
                  id: list.id,
                  name: list.name,
                  folder: folder.name,
                  space: space.name,
                  taskCount: list.task_count
                });
              }
            }
          }
        }

        // Get folderless lists in space
        const folderlessResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/list`, {
          headers: { 'Authorization': user.clickup_access_token }
        });

        if (folderlessResponse.ok) {
          const folderlessData = await folderlessResponse.json();
          const lists = folderlessData.lists || [];

          for (const list of lists) {
            allLists.push({
              id: list.id,
              name: list.name,
              folder: null,
              space: space.name,
              taskCount: list.task_count
            });
          }
        }
      }
    }

    return Response.json({ lists: allLists });

  } catch (error) {
    console.error('Get ClickUp lists error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});