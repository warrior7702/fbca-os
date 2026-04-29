import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attendees, meetingSubject, meetingDate, summary, keyPoints, actionItems } = await req.json();

    if (!attendees || attendees.length === 0) {
      return Response.json({ error: 'No attendees provided' }, { status: 400 });
    }

    // Build email body
    const emailBody = `
<h2>${meetingSubject}</h2>
<p><strong>Date:</strong> ${new Date(meetingDate).toLocaleString()}</p>

<h3>📝 Summary</h3>
<p>${summary || 'No summary available.'}</p>

${keyPoints && keyPoints.length > 0 ? `
<h3>🎯 Key Points</h3>
<ul>
${keyPoints.map(point => `<li>${point}</li>`).join('')}
</ul>
` : ''}

${actionItems && actionItems.length > 0 ? `
<h3>✅ Action Items</h3>
<ul>
${actionItems.map(item => {
  const text = typeof item === 'string' ? item : item.item || item;
  const assignee = typeof item === 'object' && item.assigned_to ? ` (${item.assigned_to})` : '';
  return `<li>${text}${assignee}</li>`;
}).join('')}
</ul>
` : ''}

<hr>
<p style="color: #666; font-size: 12px;">This summary was automatically generated and sent via FBCA OS Meetings.</p>
`;

    // Send emails to all attendees
    const emailPromises = attendees.map(attendee => {
      const email = attendee.email || attendee;
      return base44.integrations.Core.SendEmail({
        from_name: user.full_name || 'FBCA OS',
        to: email,
        subject: `Meeting Summary: ${meetingSubject}`,
        body: emailBody
      });
    });

    await Promise.all(emailPromises);

    return Response.json({ 
      success: true, 
      message: `Summary sent to ${attendees.length} attendee(s)` 
    });

  } catch (error) {
    console.error('Error sending meeting summary:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});