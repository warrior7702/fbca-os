import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is admin
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_user')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all tickets
    const tickets = await base44.entities.Ticket.list('-created_date');

    // Calculate analytics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentTickets = tickets.filter(t => 
      new Date(t.created_date) >= thirtyDaysAgo
    );

    const thisWeekTickets = tickets.filter(t => 
      new Date(t.created_date) >= sevenDaysAgo
    );

    // Status distribution
    const statusCounts = {
      open: tickets.filter(t => t.status === 'open').length,
      pending: tickets.filter(t => t.status === 'pending').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };

    // Priority distribution
    const priorityCounts = {
      low: tickets.filter(t => t.priority === 'low').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      high: tickets.filter(t => t.priority === 'high').length,
      urgent: tickets.filter(t => t.priority === 'urgent').length
    };

    // Category distribution
    const categoryCounts = {};
    tickets.forEach(ticket => {
      const category = ticket.category || 'uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Average response times
    const ticketsWithResponse = tickets.filter(t => t.time_to_first_response);
    const avgFirstResponse = ticketsWithResponse.length > 0
      ? ticketsWithResponse.reduce((sum, t) => sum + t.time_to_first_response, 0) / ticketsWithResponse.length
      : 0;

    const ticketsWithResolution = tickets.filter(t => t.time_to_resolution);
    const avgResolution = ticketsWithResolution.length > 0
      ? ticketsWithResolution.reduce((sum, t) => sum + t.time_to_resolution, 0) / ticketsWithResolution.length
      : 0;

    // SLA breaches
    const slaBreaches = tickets.filter(t => t.sla_breach).length;
    const slaCompliance = tickets.length > 0 
      ? ((tickets.length - slaBreaches) / tickets.length * 100).toFixed(1)
      : 100;

    // Tickets by day (last 30 days)
    const ticketsByDay = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = tickets.filter(t => 
        t.created_date.startsWith(dateStr)
      ).length;
      ticketsByDay.push({
        date: dateStr,
        count: count
      });
    }

    // Top requesters
    const requesterCounts = {};
    tickets.forEach(ticket => {
      const email = ticket.requester_email;
      requesterCounts[email] = (requesterCounts[email] || 0) + 1;
    });
    const topRequesters = Object.entries(requesterCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([email, count]) => ({
        email,
        count,
        name: tickets.find(t => t.requester_email === email)?.requester_name || email
      }));

    // Assigned staff performance
    const staffPerformance = {};
    tickets.forEach(ticket => {
      if (ticket.assigned_to) {
        if (!staffPerformance[ticket.assigned_to]) {
          staffPerformance[ticket.assigned_to] = {
            email: ticket.assigned_to,
            name: ticket.assigned_to_name || ticket.assigned_to,
            total: 0,
            resolved: 0,
            avg_resolution_time: 0,
            resolution_times: []
          };
        }
        staffPerformance[ticket.assigned_to].total++;
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          staffPerformance[ticket.assigned_to].resolved++;
          if (ticket.time_to_resolution) {
            staffPerformance[ticket.assigned_to].resolution_times.push(ticket.time_to_resolution);
          }
        }
      }
    });

    // Calculate average resolution times for staff
    Object.values(staffPerformance).forEach(staff => {
      if (staff.resolution_times.length > 0) {
        staff.avg_resolution_time = staff.resolution_times.reduce((a, b) => a + b, 0) / staff.resolution_times.length;
      }
      delete staff.resolution_times; // Remove array from response
    });

    return Response.json({
      summary: {
        total_tickets: tickets.length,
        tickets_last_30_days: recentTickets.length,
        tickets_this_week: thisWeekTickets.length,
        avg_first_response_minutes: Math.round(avgFirstResponse),
        avg_resolution_minutes: Math.round(avgResolution),
        sla_compliance_percentage: parseFloat(slaCompliance),
        sla_breaches: slaBreaches
      },
      status_distribution: statusCounts,
      priority_distribution: priorityCounts,
      category_distribution: categoryCounts,
      tickets_by_day: ticketsByDay,
      top_requesters: topRequesters,
      staff_performance: Object.values(staffPerformance)
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
});