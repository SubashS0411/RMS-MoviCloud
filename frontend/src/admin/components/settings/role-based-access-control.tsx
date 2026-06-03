import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Badge } from '@/admin/components/ui/badge';
import { Switch } from '@/admin/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/admin/components/ui/dialog';
import { Shield, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rolesApi } from '@/admin/utils/api';

// Local storage key for role permissions
const ROLE_PERMISSIONS_STORAGE_KEY = 'rms_role_permissions';

interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: {
    dashboard: boolean;
    menu: boolean;
    orders: boolean;
    tables: boolean;
    inventory: boolean;
    staff: boolean;
    billing: boolean;
    delivery: boolean;
    offers: boolean;
    reports: boolean;
    notifications: boolean;
    settings: boolean;
  };
}

const moduleNames: Record<string, string> = {
  dashboard: 'Dashboard',
  menu: 'Menu Management',
  orders: 'Order Management',
  tables: 'Table Management',
  inventory: 'Inventory Management',
  staff: 'Staff Management',
  billing: 'Billing & Payments',
  delivery: 'Delivery Management',
  offers: 'Offers & Loyalty',
  reports: 'Reports & Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
};

// Save role permissions to localStorage
const saveRolePermissionsToStorage = (roles: Role[]): void => {
  const permissionsMap: Record<string, string[]> = {};
  roles.forEach(role => {
    // Convert boolean permissions to array of allowed modules
    const allowedModules = Object.entries(role.permissions)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);
    permissionsMap[role.name.toLowerCase()] = allowedModules;
  });
  localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissionsMap));
  
  // Dispatch a custom event to notify other components
  window.dispatchEvent(new Event('role-permissions-updated'));
};

export function RoleBasedAccessControl() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, boolean>,
  });

  // Load roles from backend API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const data = await rolesApi.getAll();
        setRoles(data || []);
        // Save to localStorage on initial load
        if (data && data.length > 0) {
          saveRolePermissionsToStorage(data);
        }
      } catch (error) {
        console.error('Failed to load roles:', error);
        toast.error('Failed to load roles');
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, []);

  const updatePermission = async (roleId: string, permission: keyof Role['permissions']) => {
    const role = roles.find(r => r._id === roleId);
    if (!role) return;
    
    // Prevent modifying Admin role
    if (role.name === 'Admin') {
      toast.error('Cannot modify Admin role permissions');
      return;
    }

    const newPermissions = {
      ...role.permissions,
      [permission]: !role.permissions[permission],
    };

    setSaving(true);
    try {
      await rolesApi.update(roleId, {
        name: role.name,
        description: role.description,
        permissions: newPermissions,
      });
      
      setRoles(prev => prev.map(r => 
        r._id === roleId ? { ...r, permissions: newPermissions } : r
      ));
      // Save to localStorage
      const updatedRoles = roles.map(r => 
        r._id === roleId ? { ...r, permissions: newPermissions } : r
      );
      saveRolePermissionsToStorage(updatedRoles);
      toast.success('Permission updated successfully');
    } catch (error) {
      console.error('Failed to update permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    if (!newRole.name || !newRole.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const created = await rolesApi.create({
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions,
      });
      
      setRoles(prev => [...prev, created]);
      // Save to localStorage
      saveRolePermissionsToStorage([...roles, created]);
      toast.success(`Role "${newRole.name}" created successfully!`);
      setNewRole({ name: '', description: '', permissions: {} });
      setIsAddRoleOpen(false);
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error('Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRole = (role: Role) => {
    if (role.name === 'Admin') {
      toast.error('Cannot edit Admin role');
      return;
    }
    setEditingRole(role);
    setIsEditRoleOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;

    setSaving(true);
    try {
      await rolesApi.update(editingRole._id, {
        name: editingRole.name,
        description: editingRole.description,
        permissions: editingRole.permissions,
      });
      
      setRoles(prev => prev.map(r => 
        r._id === editingRole._id ? editingRole : r
      ));
      // Save to localStorage
      const updatedRoles = roles.map(r => 
        r._id === editingRole._id ? editingRole : r
      );
      saveRolePermissionsToStorage(updatedRoles);
      toast.success('Role updated successfully');
      setIsEditRoleOpen(false);
      setEditingRole(null);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    const role = roles.find(r => r._id === roleId);
    if (role?.name === 'Admin') {
      toast.error('Cannot delete Admin role');
      return;
    }
    
    setSaving(true);
    try {
      await rolesApi.delete(roleId);
      setRoles(prev => prev.filter(r => r._id !== roleId));
      // Save to localStorage
      const updatedRoles = roles.filter(r => r._id !== roleId);
      saveRolePermissionsToStorage(updatedRoles);
      toast.success('Role deleted successfully');
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-black">Role-Based Access Control</CardTitle>
                <CardDescription className="text-black">Manage user roles and module access permissions</CardDescription>
              </div>
            </div>
            <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
              <DialogTrigger asChild>
                <Button disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Define Custom Role</DialogTitle>
                  <DialogDescription>Establish role with granular permissions</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input
                      id="role-name"
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                      placeholder="e.g., Server, Supervisor, Delivery Partner"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                      placeholder="Brief description of role responsibilities"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddRoleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddRole} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {roles.map(role => (
              <Card key={role._id} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                        {role.name === 'Admin' && (
                          <Badge className="bg-purple-500">System Role</Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">{role.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditRole(role)}
                        disabled={role.name === 'Admin' || saving}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteRole(role._id)}
                        disabled={role.name === 'Admin' || saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Module Access Permissions
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(role.permissions || {}).map(([key, value]) => (
                        <div 
                          key={key} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Label 
                            htmlFor={`${role._id}-${key}`} 
                            className="cursor-pointer flex-1"
                          >
                            {moduleNames[key] || key}
                          </Label>
                          <Switch
                            id={`${role._id}-${key}`}
                            checked={value}
                            onCheckedChange={() => updatePermission(role._id, key as keyof Role['permissions'])}
                            disabled={role.name === 'Admin' || saving}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role name and description</DialogDescription>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input
                  id="edit-role-name"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  placeholder="e.g., Server, Supervisor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-description">Description</Label>
                <Input
                  id="edit-role-description"
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  placeholder="Brief description of role"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
