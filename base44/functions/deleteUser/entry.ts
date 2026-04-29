import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify caller is authenticated (using your Gmail)
        const caller = await base44.auth.me();
        if (!caller) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { email } = body;

        if (!email) {
            return Response.json({ error: 'Email required' }, { status: 400 });
        }

        console.log('Attempting to delete user:', email);

        // Find the user by email
        const users = await base44.asServiceRole.entities.User.filter({ email });
        
        if (!users || users.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const userToDelete = users[0];
        console.log('Found user:', userToDelete.id);

        // Delete the user using service role
        await base44.asServiceRole.entities.User.delete(userToDelete.id);
        
        console.log('User deleted successfully');

        return Response.json({ 
            success: true,
            message: `User ${email} deleted successfully`
        });

    } catch (error) {
        console.error('Delete user error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});