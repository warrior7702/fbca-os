import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticket_id, response_type } = await req.json();

    if (!ticket_id) {
      return Response.json({ error: 'ticket_id required' }, { status: 400 });
    }

    // Get the ticket
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }
    const ticket = tickets[0];

    // Find similar resolved tickets for context
    const similarTickets = await base44.asServiceRole.entities.Ticket.filter({
      category: ticket.category,
      status: { $in: ['resolved', 'closed'] }
    }, '-created_date', 5);

    // Build context from similar tickets
    let historicalContext = '';
    if (similarTickets.length > 0) {
      historicalContext = '\n\nHistorical Context (similar resolved tickets):\n';
      similarTickets.forEach((t, idx) => {
        historicalContext += `\n${idx + 1}. Issue: ${t.subject}\n   Description: ${t.description}\n`;
        if (t.suggested_solution) {
          historicalContext += `   Solution: ${t.suggested_solution}\n`;
        }
        if (t.comments && t.comments.length > 0) {
          const resolution = t.comments[t.comments.length - 1];
          historicalContext += `   Resolution: ${resolution.content}\n`;
        }
      });
    }

    let prompt = '';
    if (response_type === 'solution') {
      prompt = `You are a helpful support agent at a church organization. Analyze this ticket and provide a clear, actionable solution.

Current Ticket:
Subject: ${ticket.subject}
Category: ${ticket.category}
Building: ${ticket.building || 'Not specified'}
Room: ${ticket.room_number || 'Not specified'}
Description: ${ticket.description}
${historicalContext}

Provide a professional solution (2-3 paragraphs) that addresses the issue, references any similar past solutions, and includes clear next steps.`;

    } else if (response_type === 'response') {
      const lastComment = ticket.comments?.[ticket.comments.length - 1];
      prompt = `You are a helpful support agent at a church organization. Draft a professional response to the requester.

Current Ticket:
Subject: ${ticket.subject}
Category: ${ticket.category}
Description: ${ticket.description}
${lastComment ? `\nLast Comment from Requester: ${lastComment.content}` : ''}
${historicalContext}

Draft a friendly, professional response (2-3 paragraphs) that:
1. Acknowledges their request
2. Provides helpful information or next steps
3. Sets expectations for resolution time if applicable`;

    } else if (response_type === 'status_update') {
      prompt = `You are a support agent providing a status update to a requester.

Ticket: ${ticket.subject}
Current Status: ${ticket.status}
Category: ${ticket.category}

Draft a brief, professional status update (1-2 paragraphs) that explains the current status and what happens next.`;
    }

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    return Response.json({ 
      success: true,
      response: aiResponse,
      similar_tickets_count: similarTickets.length
    });

  } catch (error) {
    console.error('Error generating AI response:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});