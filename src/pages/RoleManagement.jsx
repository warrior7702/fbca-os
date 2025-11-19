import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Shield,
  Loader2,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  Check,
  X,
  Lock,
  Crown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RoleManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] });
  const [assignUser, setAssignUser] = useState({ user_email: '', role_id: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin' && currentUser.role !== 'super_user') {
        toast.error('Unauthorized access');
        navigate(createPageUrl('Dashboard'));
        return;
      }

      const [rolesData, permsData, usersData, userRolesData] = await Promise.all([
        base44.entities.Role.list('name'),
        base44.entities.Permission.list('category'),
        base44.entities.User.list('full_name'),
        base44.entities.UserRole.list('-created_date')
      ]);

      setRoles(rolesData);
      setPermissions(permsData);
      setUsers(usersData);
      setUserRoles(userRolesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load role data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name) {
      toast.error('Role name is required');
      return;
    }

    try {
      await base44.entities.Role.create({
        name: newRole.name,
        description: newRole.description,
        is_system: false,
        permissions: newRole.permissions
      });
      toast.success('Role created successfully');
      setShowCreateDialog(false);
      setNewRole({ name: '', description: '', permissions: [] });
      loadData();
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async (role) => {
    try {
      await base44.entities.Role.update(role.id, {
        name: role.name,
        description: role.description,
        permissions: role.permissions
      });
      toast.success('Role updated');
      setEditingRole(null);
      loadData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId, isSystem) => {
    if (isSystem) {
      toast.error('Cannot delete system roles');
      return;
    }

    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await base44.entities.Role.delete(roleId);
      toast.success('Role deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleAssignRole = async () => {
    if (!assignUser.user_email || !assignUser.role_id) {
      toast.error('Please select both user and role');
      return;
    }

    const selectedRole = roles.find(r => r.id === assignUser.role_id);

    try {
      await base44.entities.UserRole.create({
        user_email: assignUser.user_email,
        role_id: assignUser.role_id,
        role_name: selectedRole?.name,
        assigned_by: user.email,
        assigned_at: new Date().toISOString()
      });
      toast.success('Role assigned to user');
      setShowAssignDialog(false);
      setAssignUser({ user_email: '', role_id: '' });
      loadData();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveUserRole = async (userRoleId) => {
    if (!confirm('Remove this role from user?')) return;

    try {
      await base44.entities.UserRole.delete(userRoleId);
      toast.success('Role removed from user');
      loadData();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Failed to remove role');
    }
  };

  const handleInitializePermissions = async () => {
    try {
      const response = await base44.functions.invoke('initializePermissions');
      if (response.data.success) {
        toast.success(`Initialized: ${response.data.permissions_created} permissions, ${response.data.roles_created} roles`);
        loadData();
      }
    } catch (error) {
      console.error('Error initializing:', error);
      toast.error('Failed to initialize permissions');
    }
  };

  const togglePermission = (role, permCode) => {
    const currentPerms = role.permissions || [];
    const newPerms = currentPerms.includes(permCode)
      ? currentPerms.filter(p => p !== permCode)
      : [...currentPerms, permCode];
    
    if (editingRole) {
      setEditingRole({ ...role, permissions: newPerms });
    } else {
      setNewRole({ ...role, permissions: newPerms });
    }
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-blue-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Settings') + '?tab=admin')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" />
                Role Management
                {user?.role === 'super_user' && <Crown className="w-5 h-5 text-purple-500" />}
              </h1>
              <p className="text-sm text-slate-600">Manage roles and permissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            {permissions.length === 0 && (
              <Button onClick={handleInitializePermissions} variant="outline">
                <Shield className="w-4 h-4 mr-2" />
                Initialize System
              </Button>
            )}
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Role
            </Button>
          </div>
        </div>

        <Tabs defaultValue="roles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
            <TabsTrigger value="permissions">Permissions ({permissions.length})</TabsTrigger>
            <TabsTrigger value="assignments">User Assignments ({userRoles.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-4">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        role.is_system ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      }`}>
                        {role.is_system ? <Lock className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-white" />}
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {role.name}
                          {role.is_system && <Badge variant="outline">System</Badge>}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRole(role)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id, role.is_system)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {(role.permissions || []).map((permCode) => {
                      const perm = permissions.find(p => p.code === permCode);
                      return perm ? (
                        <Badge key={permCode} variant="secondary" className="text-xs">
                          {perm.name}
                        </Badge>
                      ) : null;
                    })}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <p className="text-sm text-slate-500">No permissions assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{perm.name}</p>
                          <p className="text-xs text-slate-600">{perm.description}</p>
                          <p className="text-xs text-slate-400 mt-1 font-mono">{perm.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>User Role Assignments</CardTitle>
                  <Button onClick={() => setShowAssignDialog(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Assign Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {userRoles.map((ur) => {
                    const userInfo = users.find(u => u.email === ur.user_email);
                    return (
                      <div key={ur.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {userInfo?.full_name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{userInfo?.full_name || ur.user_email}</p>
                            <p className="text-sm text-slate-600">{ur.user_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{ur.role_name}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUserRole(ur.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {userRoles.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No role assignments yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Role Dialog */}
        <Dialog open={showCreateDialog || !!editingRole} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingRole(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Role Name *</Label>
                <Input
                  value={editingRole ? editingRole.name : newRole.name}
                  onChange={(e) => editingRole 
                    ? setEditingRole({...editingRole, name: e.target.value})
                    : setNewRole({...newRole, name: e.target.value})
                  }
                  placeholder="e.g., Support Manager"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingRole ? editingRole.description : newRole.description}
                  onChange={(e) => editingRole
                    ? setEditingRole({...editingRole, description: e.target.value})
                    : setNewRole({...newRole, description: e.target.value})
                  }
                  placeholder="What this role is for..."
                  rows={3}
                />
              </div>
              <div>
                <Label className="mb-3 block">Permissions</Label>
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="mb-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2 capitalize">{category}</p>
                    <div className="space-y-2 pl-4">
                      {perms.map((perm) => {
                        const role = editingRole || newRole;
                        const isChecked = (role.permissions || []).includes(perm.code);
                        return (
                          <div key={perm.code} className="flex items-start gap-2">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => togglePermission(role, perm.code)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{perm.name}</p>
                              <p className="text-xs text-slate-600">{perm.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setEditingRole(null);
              }}>
                Cancel
              </Button>
              <Button onClick={() => editingRole ? handleUpdateRole(editingRole) : handleCreateRole()}>
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Role Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role to User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Select User</Label>
                <Select value={assignUser.user_email} onValueChange={(value) => setAssignUser({...assignUser, user_email: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.email}>
                        {u.full_name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Role</Label>
                <Select value={assignUser.role_id} onValueChange={(value) => setAssignUser({...assignUser, role_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignRole}>
                Assign Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}