import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all tickets from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const allTickets = await base44.asServiceRole.entities.Ticket.list('-created_date');
    const recentTickets = allTickets.filter(t => 
      new Date(t.created_date) >= ninetyDaysAgo
    );

    // Group by category
    const categoryGroups = {};
    recentTickets.forEach(ticket => {
      const cat = ticket.category || 'uncategorized';
      if (!categoryGroups[cat]) {
        categoryGroups[cat] = [];
      }
      categoryGroups[cat].push(ticket);
    });

    // Build analysis prompt
    const categorySummary = Object.entries(categoryGroups)
      .map(([cat, tickets]) => {
        const avgResolutionTime = tickets
          .filter(t => t.time_to_resolution)
          .reduce((sum, t) => sum + t.time_to_resolution, 0) / 
          (tickets.filter(t => t.time_to_resolution).length || 1);
        
        return `${cat}: ${tickets.length} tickets, avg resolution: ${Math.round(avgResolutionTime)} min`;
      })
      .join('\n');

    // Get common subjects/issues
    const subjects = recentTickets.map(t => t.subject + ': ' + t.description.substring(0, 100));
    const subjectSample = subjects.slice(0, 30).join('\n');

    const prompt = `You are analyzing support ticket data for a church organization. Analyze these trends and provide actionable insights.

TICKET STATISTICS (Last 90 days):
Total Tickets: ${recentTickets.length}

By Category:
${categorySummary}

Sample Recent Issues:
${subjectSample}

Provide a JSON response with:
{
  "recurring_issues": [
    {
      "issue": "brief description",
      "frequency": "high/medium/low",
      "affected_categories": ["category1", "category2"],
      "recommendation": "what to do about it"
    }
  ],
  "improvement_areas": [
    {
      "area": "area name",
      "current_state": "description",
      "suggested_action": "what to improve"
    }
  ],
  "positive_trends": [
    {
      "trend": "description of good trend"
    }
  ]
}`;

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          recurring_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                issue: { type: "string" },
                frequency: { type: "string" },
                affected_categories: { type: "array", items: { type: "string" } },
                recommendation: { type: "string" }
              }
            }
          },
          improvement_areas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                current_state: { type: "string" },
                suggested_action: { type: "string" }
              }
            }
          },
          positive_trends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                trend: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({ 
      success: true,
      analysis,
      stats: {
        total_tickets: recentTickets.length,
        categories: Object.keys(categoryGroups).length,
        time_period: '90 days'
      }
    });

  } catch (error) {
    console.error('Error analyzing trends:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});