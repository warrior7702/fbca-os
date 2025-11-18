import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, siteName, siteUrl } = await req.json();

    if (!siteId || !siteName) {
      return Response.json({ error: 'siteId and siteName required' }, { status: 400 });
    }

    console.log('Categorizing site:', siteName);

    // Get SSO token
    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);
    if (!ssoToken) {
      return Response.json({ error: 'Microsoft not connected' }, { status: 403 });
    }

    // Fetch site libraries to analyze content
    const librariesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    let libraryNames = [];
    if (librariesResponse.ok) {
      const librariesData = await librariesResponse.json();
      libraryNames = librariesData.value?.map(lib => lib.name) || [];
    }

    // Fetch recent files from the site
    const filesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children?$top=20`,
      {
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        }
      }
    );

    let fileNames = [];
    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      fileNames = filesData.value?.map(file => file.name) || [];
    }

    // Use AI to categorize based on site name, libraries, and file names
    const prompt = `Analyze this SharePoint site and categorize it:

Site Name: ${siteName}
Site URL: ${siteUrl || 'N/A'}
Libraries: ${libraryNames.join(', ') || 'None'}
Sample Files: ${fileNames.slice(0, 10).join(', ') || 'None'}

Based on this information, categorize this site. Provide:
1. A primary category (e.g., "Ministry Resources", "Administrative", "Events & Programs", "Media & Communications", "Operations", "Department Files", "Project Collaboration")
2. 3-5 relevant tags
3. A brief description of what this site is used for

Return your response as JSON.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          category: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          description: { type: "string" }
        }
      }
    });

    console.log('AI categorization:', aiResponse);

    // Update or create SharePointSiteAccess with AI categorization
    const existing = await base44.asServiceRole.entities.SharePointSiteAccess.filter({
      user_email: user.email,
      site_id: siteId
    });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.SharePointSiteAccess.update(existing[0].id, {
        ai_category: aiResponse.category,
        ai_tags: aiResponse.tags,
        ai_description: aiResponse.description,
        categorized_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.SharePointSiteAccess.create({
        user_email: user.email,
        site_id: siteId,
        site_name: siteName,
        site_url: siteUrl || '',
        access_count: 0,
        is_favorited: false,
        last_accessed: new Date().toISOString(),
        ai_category: aiResponse.category,
        ai_tags: aiResponse.tags,
        ai_description: aiResponse.description,
        categorized_at: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      category: aiResponse.category,
      tags: aiResponse.tags,
      description: aiResponse.description
    });

  } catch (error) {
    console.error('Error categorizing site:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});