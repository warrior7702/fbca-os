import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json().catch(() => ({}));
    const { assigned_to_email: providedEmail, status, limit = 20, include_unassigned = false } = body;

    // Determine assigned user email
    let assignedEmail = providedEmail;
    
    if (!assignedEmail) {
      // Try to get from authenticated user
      try {
        const user = await base44.auth.me();
        assignedEmail = user?.email;
      } catch (error) {
        // No authenticated user, that's ok - we'll check below
      }
    }

    // If still no email, return error
    if (!assignedEmail) {
      return Response.json({ 
        success: false, 
        error: 'No assigned_to_email provided and no authenticated user found' 
      }, { status: 200 });
    }

    // Get user's departments first
    const rolesResponse = await base44.asServiceRole.functions.invoke('getUsersWithTicketRoles');
    let userDepartments = [];
    if (rolesResponse.data?.success) {
      const userData = rolesResponse.data.allUsers.find(u => u.user_email === assignedEmail);
      userDepartments = userData?.departments || [];
    }

    // Query tickets assigned to this user using service role for admin access
    const allTickets = await base44.asServiceRole.entities.Ticket.list('-created_date', 200);
    
    // Filter to tickets assigned to this user
    let filteredTickets = allTickets.filter(ticket => {
      const isAssignedToUser = ticket.assigned_to === assignedEmail || ticket.assigned_to_2 === assignedEmail;
      const isSupportCategory = ticket.category && ['technology', 'cleaning', 'maintenance'].includes(ticket.category);
      
      if (!isSupportCategory) return false;
      
      // Include if assigned to user
      if (isAssignedToUser) return true;
      
      // If include_unassigned flag is set, also include unassigned tickets in user's departments
      if (include_unassigned && !ticket.assigned_to && ticket.assigned_department) {
        return userDepartments.some(dept => 
          dept.toLowerCase() === ticket.assigned_department.toLowerCase()
        );
      }
      
      return false;
    });

    // Apply status filter if provided
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      filteredTickets = filteredTickets.filter(ticket => 
        statusArray.includes(ticket.status)
      );
    }

    // Limit results
    filteredTickets = filteredTickets.slice(0, limit);

    // Return only the specified fields including id for clickable links
    const response = {
      success: true,
      assigned_to_email: assignedEmail,
      departments: userDepartments,
      count: filteredTickets.length,
      tickets: filteredTickets.map(ticket => ({
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
    };

    return Response.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in getMyAssignedTickets:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error occurred' 
    }, { status: 200 });
  }
});