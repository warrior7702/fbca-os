import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getAccessToken(base44, user) {
  try {
    const token = await base44.asServiceRole.sso.getAccessToken(user.id);
    if (!token) {
      throw new Error("SSO token not available. Please ensure you are logged in with Microsoft.");
    }
    return token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw new Error("Failed to retrieve access token. Re-authentication may be required.");
  }
}

async function fetchWithToken(url, accessToken) {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Graph API error (${response.status}):`, errorBody);
    throw new Error(`Microsoft Graph API request failed with status ${response.status}`);
  }
  return response.json();
}

function findUnsubscribeLink(emailBody) {
  if (!emailBody || !emailBody.content) return null;

  // Regex to find http/https unsubscribe links
  const unsubscribeRegex = /<a[^>]+href=["'](https?:\/\/[^"']*(?:unsubscribe|optout|subscription)[^"']*)["'][^>]*>.*<\/a>/i;
  const match = emailBody.content.match(unsubscribeRegex);
  
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const accessToken = await getAccessToken(base44, user);
    
    // Get top 50 emails from inbox, selecting fields and including body
    const messagesUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$select=id,subject,from,receivedDateTime,bodyPreview,webLink,body,listUnsubscribe`;
    
    const data = await fetchWithToken(messagesUrl, accessToken);
    const emails = data.value || [];

    const emailsWithUnsubscribe = emails.map(email => {
      let unsubscribeUrl = null;
      // Prefer List-Unsubscribe header
      if (email.listUnsubscribe) {
        // Extract URL from header (e.g., "<mailto:...>, <http://...>")
        const httpMatch = email.listUnsubscribe.match(/<(https?:\/\/[^>]+)>/);
        if (httpMatch) {
          unsubscribeUrl = httpMatch[1];
        }
      }
      
      // Fallback to body search if no header link
      if (!unsubscribeUrl) {
        unsubscribeUrl = findUnsubscribeLink(email.body);
      }
      
      return {
        id: email.id,
        subject: email.subject,
        from: email.from.emailAddress,
        fromName: email.from.emailAddress.name,
        receivedAt: email.receivedDateTime,
        bodyPreview: email.bodyPreview,
        webLink: email.webLink,
        hasUnsubscribeLink: !!unsubscribeUrl,
        unsubscribeUrl: unsubscribeUrl
      };
    });

    return new Response(JSON.stringify({ emails: emailsWithUnsubscribe }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in getEmailsWithUnsubscribe function:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});