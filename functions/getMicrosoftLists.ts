import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    
    if (!accessToken) {
      return Response.json({ 
        error: 'Microsoft 365 not connected',
        needsAuth: true 
      }, { status: 403 });
    }

    // Get all lists from SharePoint
    const sitesResponse = await fetch(
      'https://graph.microsoft.com/v1.0/sites?search=*',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!sitesResponse.ok) {
      const errorText = await sitesResponse.text();
      console.error('Sites API error:', errorText);
      return Response.json({ error: 'Failed to fetch sites' }, { status: 500 });
    }

    const sitesData = await sitesResponse.json();
    const sites = sitesData.value || [];

    // Get lists from each site
    const allTasks = [];
    
    for (const site of sites.slice(0, 5)) { // Limit to first 5 sites to avoid timeout
      try {
        const listsResponse = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$filter=list/template eq 'tasks' or displayName eq 'Tasks'`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (listsResponse.ok) {
          const listsData = await listsResponse.json();
          const lists = listsData.value || [];

          for (const list of lists) {
            try {
              const itemsResponse = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${site.id}/lists/${list.id}/items?$expand=fields`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (itemsResponse.ok) {
                const itemsData = await itemsResponse.json();
                const items = itemsData.value || [];

                items.forEach(item => {
                  const fields = item.fields || {};
                  
                  allTasks.push({
                    id: item.id,
                    list_id: list.id,
                    site_id: site.id,
                    title: fields.Title || 'Untitled Task',
                    status: fields.Status || 'Not Started',
                    priority: fields.Priority || 'Normal',
                    due_date: fields.DueDate || null,
                    assigned_to: fields.AssignedTo || null,
                    description: fields.Description || '',
                    completed: fields.PercentComplete === 1 || fields.Status === 'Completed',
                    list_name: list.displayName,
                    site_name: site.displayName,
                    source: 'microsoft_lists'
                  });
                });
              }
            } catch (error) {
              console.error(`Error fetching items from list ${list.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching lists from site ${site.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      tasks: allTasks,
      count: allTasks.length
    });

  } catch (error) {
    console.error('Microsoft Lists error:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});