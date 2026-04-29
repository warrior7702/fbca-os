import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, listId, columnName, columnType, required, description } = await req.json();

    if (!siteId || !listId || !columnName || !columnType) {
      return Response.json({ 
        error: 'siteId, listId, columnName, and columnType are required' 
      }, { status: 400 });
    }

    const ssoToken = await base44.asServiceRole.sso.getAccessToken(user.id);

    if (!ssoToken) {
      return Response.json({ 
        success: false, 
        error: 'Microsoft 365 not connected' 
      }, { status: 403 });
    }

    // Build column definition based on type
    const columnDef = {
      name: columnName,
      displayName: columnName,
      description: description || '',
      required: required || false,
      enforceUniqueValues: false,
      indexed: false
    };

    // Add type-specific properties
    switch (columnType) {
      case 'text':
        columnDef.text = { maxLength: 255 };
        break;
      case 'number':
        columnDef.number = {};
        break;
      case 'boolean':
        columnDef.boolean = {};
        break;
      case 'dateTime':
        columnDef.dateTime = { format: 'dateTime' };
        break;
      case 'choice':
        columnDef.choice = { 
          choices: ['Option 1', 'Option 2', 'Option 3'],
          allowTextEntry: false 
        };
        break;
      case 'multiChoice':
        columnDef.choice = { 
          choices: ['Option 1', 'Option 2', 'Option 3'],
          allowTextEntry: false 
        };
        break;
      default:
        columnDef.text = { maxLength: 255 };
    }

    // Add the column
    const addResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`,
      {
        method: 'POST',
        headers: {
          'Authorization': ssoToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(columnDef)
      }
    );

    if (!addResponse.ok) {
      const errorText = await addResponse.text();
      console.error('Add column error:', addResponse.status, errorText);
      return Response.json({ 
        success: false, 
        error: `Failed to add column: ${errorText.substring(0, 200)}` 
      }, { status: 500 });
    }

    const newColumn = await addResponse.json();

    return Response.json({
      success: true,
      column: newColumn
    });

  } catch (error) {
    console.error('Error adding SharePoint column:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});