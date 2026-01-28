import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const {
      assigned_to_email: providedEmail,
      status,
      limit = 20,
      include_unassigned = false
    } = body;

    let assignedEmail = providedEmail;

    if (!assignedEmail) {
      try {
        const user = await base44.auth.me();
        assignedEmail = user?.email;
      } catch {
        // ignore
      }
    }

    if (!assignedEmail) {
      return Response.json({
        success: false,
        error: 'No assigned_to_email provided and no authenticated user found'
      }, { status: 200 });
    }

    // Get all tickets
    const listResp = await base44.asServiceRole.entities.Ticket.list('-created_date');
    const allTickets = Array.isArray(listResp) ? listResp : (listResp?.data || []);

    // Get user's departments from TicketRoleAssignment entity
    let userDepartments = [];
    try {
      const roleAssignments = await base44.asServiceRole.entities.TicketRoleAssignment.filter({
        user_email: assignedEmail
      });
      if (roleAssignments.length > 0 && roleAssignments[0].department) {
        userDepartments = [roleAssignments[0].department];
      }
    } catch (error) {
      console.error('Error fetching user departments:', error);
    }

    // Base filter
    let filteredTickets = allTickets.filter(ticket =>
      ticket.category &&
      ['technology', 'cleaning', 'maintenance'].includes(ticket.category)
    );

    // Assigned to user
    const assignedTickets = filteredTickets.filter(ticket =>
      ticket.assigned_to === assignedEmail || ticket.assigned_to_2 === assignedEmail
    );

    // Unassigned in user's departments
    let unassignedTickets = [];
    if (include_unassigned && userDepartments.length) {
      // Map category to department
      const categoryToDept = {
        'technology': 'IT',
        'cleaning': 'Facilities',
        'maintenance': 'Facilities'
      };
      
      unassignedTickets = filteredTickets.filter(ticket => {
        if (ticket.assigned_to || ticket.assigned_to_2) return false;
        
        // Check assigned_department if set, otherwise map from category
        const ticketDept = ticket.assigned_department || categoryToDept[ticket.category];
        return ticketDept && userDepartments.includes(ticketDept);
      });
    }

    // Merge + de-dupe
    let merged = [...assignedTickets, ...unassignedTickets];

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      merged = merged.filter(ticket => statusArray.includes(ticket.status));
    }

    merged = merged.slice(0, limit);

    return Response.json({
      success: true,
      assigned_to_email: assignedEmail,
      departments: userDepartments,
      count: merged.length,
      tickets: merged.map(ticket => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assigned_department: ticket.assigned_department,
        assigned_to: ticket.assigned_to,
        assigned_to_name: ticket.assigned_to_name,
        created_date: ticket.created_date,
        due_date: ticket.due_date
      }))
    }, { status: 200 });

  } catch (error) {
    console.error('Error in getMyAssignedTickets:', error);
    return Response.json({
      success: false,
      error: 'Internal server error occurred'
    }, { status: 200 });
  }
});