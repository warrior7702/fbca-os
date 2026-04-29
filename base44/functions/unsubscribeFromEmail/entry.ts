import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getAccessToken(base44, user) {
  const token = await base44.asServiceRole.sso.getAccessToken(user.id);
  if (!token) throw new Error("Microsoft SSO token not available.");
  return token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { emailId, unsubscribeUrl } = await req.json();

    if (!emailId || !unsubscribeUrl) {
      return new Response(JSON.stringify({ error: 'emailId and unsubscribeUrl are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 1. Perform the unsubscribe by visiting the link
    // We don't care about the response, just that we attempted it.
    // Use a timeout to avoid waiting too long for external sites.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      await fetch(unsubscribeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      // Ignore fetch errors (e.g., timeout, network issue), as we'll still archive.
      console.warn(`Unsubscribe fetch for ${unsubscribeUrl} failed, but proceeding to archive. Error: ${fetchError.message}`);
    }

    // 2. Archive the email
    const accessToken = await getAccessToken(base44, user);
    const archiveUrl = `https://graph.microsoft.com/v1.0/me/messages/${emailId}`;
    
    // To archive, we move it to the "Archive" folder. 
    // First, we need the ID of the "Archive" folder.
    const foldersUrl = "https://graph.microsoft.com/v1.0/me/mailFolders?$filter=displayName eq 'Archive'";
    const foldersResponse = await fetch(foldersUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (!foldersResponse.ok) throw new Error('Failed to find Archive folder.');
    
    const foldersData = await foldersResponse.json();
    if (!foldersData.value || foldersData.value.length === 0) {
      throw new Error('Archive folder not found.');
    }
    const archiveFolderId = foldersData.value[0].id;

    // Now, move the email
    const moveResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${emailId}/move`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destinationId: archiveFolderId
      })
    });

    if (!moveResponse.ok) {
      const errorBody = await moveResponse.text();
      console.error('Failed to archive email:', errorBody);
      throw new Error('Failed to archive email after unsubscribe attempt.');
    }

    return new Response(JSON.stringify({ success: true, message: 'Unsubscribe attempted and email archived.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in unsubscribeFromEmail function:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});