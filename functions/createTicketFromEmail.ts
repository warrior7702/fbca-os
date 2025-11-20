import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Smart assignment rules based on keywords and categories
const assignmentRules = {
    'facilities': {
        keywords: ['hvac', 'plumbing', 'electrical', 'maintenance', 'repair', 'broken', 'lights', 'air conditioning', 'heating', 'door', 'lock', 'building'],
        team: 'facilities',
        defaultAssignee: null // Could add specific email here
    },
    'it': {
        keywords: ['computer', 'laptop', 'wifi', 'network', 'internet', 'password', 'login', 'software', 'printer', 'phone', 'tech', 'zoom', 'teams', 'email'],
        team: 'it',
        defaultAssignee: null
    },
    'av_production': {
        keywords: ['sound', 'audio', 'video', 'camera', 'microphone', 'projection', 'screen', 'livestream', 'recording', 'av', 'media'],
        team: 'av_production',
        defaultAssignee: null
    },
    'marketing': {
        keywords: ['graphic', 'design', 'social media', 'website', 'flyer', 'poster', 'announcement', 'communication', 'branding'],
        team: 'marketing',
        defaultAssignee: null
    },
    'catering': {
        keywords: ['food', 'catering', 'meal', 'lunch', 'dinner', 'breakfast', 'coffee', 'kitchen'],
        team: 'hospitality',
        defaultAssignee: null
    }
};

function determineAssignment(subject, description) {
    const combinedText = `${subject} ${description}`.toLowerCase();
    
    // Check each category for keyword matches
    for (const [category, config] of Object.entries(assignmentRules)) {
        for (const keyword of config.keywords) {
            if (combinedText.includes(keyword)) {
                return {
                    category: category === 'catering' ? 'catering' : category === 'av_production' ? 'av_production' : category,
                    team: config.team,
                    assigned_to: config.defaultAssignee
                };
            }
        }
    }
    
    // Default assignment
    return {
        category: 'other',
        team: 'admin',
        assigned_to: null
    };
}

async function findSimilarTickets(base44, description) {
    try {
        // Get all resolved tickets
        const resolvedTickets = await base44.asServiceRole.entities.Ticket.filter({
            status: { $in: ['resolved', 'closed'] }
        });
        
        // Use AI to find similar tickets and suggest solutions
        const ticketSummaries = resolvedTickets.slice(0, 50).map(t => 
            `Issue: ${t.subject}\nDescription: ${t.description}\nResolution: ${t.comments?.[t.comments.length - 1]?.content || 'N/A'}`
        ).join('\n\n---\n\n');
        
        const prompt = `You are analyzing a new support ticket to find similar past issues and suggest solutions.

NEW TICKET:
"${description}"

PAST RESOLVED TICKETS:
${ticketSummaries}

Analyze the new ticket and:
1. Identify if any past tickets dealt with similar issues
2. Suggest a solution based on what worked before
3. Keep your response under 150 words and actionable

If no similar tickets found, suggest general troubleshooting steps for this type of issue.`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            add_context_from_internet: false
        });

        return response;
    } catch (error) {
        console.error('Error finding similar tickets:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email_id, subject, body, from_email, from_name, attachments = [] } = await req.json();

        if (!subject || !body) {
            return Response.json({ error: 'Subject and body required' }, { status: 400 });
        }

        // Generate ticket number
        const timestamp = Date.now().toString().slice(-6);
        const ticketNumber = `TKT-${timestamp}`;

        // Determine priority based on keywords
        let priority = 'medium';
        const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
        const highKeywords = ['important', 'soon', 'needed', 'broken'];
        
        const lowerText = `${subject} ${body}`.toLowerCase();
        if (urgentKeywords.some(kw => lowerText.includes(kw))) {
            priority = 'urgent';
        } else if (highKeywords.some(kw => lowerText.includes(kw))) {
            priority = 'high';
        }

        // Smart assignment
        const assignment = determineAssignment(subject, body);

        // Extract building and room using AI
        let building = '';
        let room_number = '';
        
        try {
            const locationPrompt = `Extract the building and room number from this text. Return ONLY a JSON object with "building" and "room_number" fields. If not found, use empty strings.

Valid buildings are: wade, fbc, pcb, sc

Text: "${subject} ${body}"

Examples:
- "Computer broken in WADE room 101" -> {"building": "wade", "room_number": "101"}
- "FBC hallway needs cleaning" -> {"building": "fbc", "room_number": ""}
- "Room 205 at PCB" -> {"building": "pcb", "room_number": "205"}

Return JSON only:`;

            const locationData = await base44.integrations.Core.InvokeLLM({
                prompt: locationPrompt,
                add_context_from_internet: false,
                response_json_schema: {
                    type: "object",
                    properties: {
                        building: { type: "string" },
                        room_number: { type: "string" }
                    }
                }
            });

            if (locationData?.building) building = locationData.building.toLowerCase();
            if (locationData?.room_number) room_number = locationData.room_number;
        } catch (error) {
            console.warn('Could not extract location:', error);
        }

        // Find similar tickets and get AI suggestions
        const suggestedSolution = await findSimilarTickets(base44, `${subject}: ${body}`);

        // Create ticket
        const ticketData = {
            ticket_number: ticketNumber,
            subject: subject,
            description: body,
            building: building || undefined,
            room_number: room_number || undefined,
            status: 'open',
            priority: priority,
            category: assignment.category,
            requester_email: from_email || currentUser.email,
            requester_name: from_name || currentUser.full_name,
            assigned_to: assignment.assigned_to,
            team: assignment.team,
            source: 'email',
            email_thread_id: email_id,
            tags: [],
            attachments: attachments.map(att => ({
                name: att.name,
                url: att.url,
                uploaded_at: new Date().toISOString()
            })),
            comments: [],
            suggested_solution: suggestedSolution,
            last_activity_at: new Date().toISOString()
        };

        const ticket = await base44.asServiceRole.entities.Ticket.create(ticketData);

        console.log('✅ Created ticket:', ticketNumber, '| Category:', assignment.category, '| Priority:', priority);

        return Response.json({
            ok: true,
            ticket: ticket,
            assignment: {
                category: assignment.category,
                team: assignment.team,
                assigned_to: assignment.assigned_to
            },
            ai_suggestion: !!suggestedSolution
        });

    } catch (error) {
        console.error('Create ticket from email error:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});