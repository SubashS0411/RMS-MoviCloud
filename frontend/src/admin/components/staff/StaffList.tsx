import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/admin/components/ui/card";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { Badge } from "@/admin/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/admin/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/admin/components/ui/dialog";
import { Label } from "@/admin/components/ui/label";
import { 
  Search, 
  FileDown, 
  Plus, 
  Pencil, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal,
  Loader2,
  Trash2,
  Wallet,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Textarea } from '@/admin/components/ui/textarea';
import { ScrollArea } from '@/admin/components/ui/scroll-area';
import { staffApi } from '@/admin/utils/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/admin/components/ui/alert-dialog";

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  shift: string;
  department?: string;
  salary?: number;
  active: boolean;
  hireDate?: string;
  kitchenStation?: string;
  kitchenPin?: string;
}

interface NewStaffForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  shift: string;
  department: string;
  salary: string;
  password: string;
  kitchenStation: string;
  kitchenPin: string;
}

interface StaffListProps {
  globalSearch?: string;
  globalRoleFilter?: string;
  globalShiftFilter?: string;
}

export function StaffList({ globalSearch = '', globalRoleFilter = 'all', globalShiftFilter = 'all' }: StaffListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payStaff, setPayStaff] = useState<StaffMember | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    paymentMethod: 'cash',
    notes: '',
  });
  const [newStaff, setNewStaff] = useState<NewStaffForm>({
    name: '',
    email: '',
    phone: '',
    role: 'waiter',
    shift: 'morning',
    department: 'service',
    salary: '',
    password: '',
    kitchenStation: '',
    kitchenPin: '',
  });
  const [editStaff, setEditStaff] = useState<NewStaffForm>({
    name: '',
    email: '',
    phone: '',
    role: 'waiter',
    shift: 'morning',
    department: 'service',
    salary: '',
    password: '',
    kitchenStation: '',
    kitchenPin: '',
  });

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, shiftFilter]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: { role?: string; active?: boolean; shift?: string } = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (shiftFilter !== 'all') params.shift = shiftFilter;
      
      const data = await staffApi.list(params);
      setStaff(data || []);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!newStaff.password || newStaff.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      await staffApi.create({
        name: newStaff.name,
        email: newStaff.email,
        password: newStaff.password,
        phone: newStaff.phone || undefined,
        role: newStaff.role,
        shift: newStaff.shift,
        department: newStaff.department,
        salary: newStaff.salary ? parseFloat(newStaff.salary) : undefined,
        active: true,
        ...(newStaff.role === 'chef' && newStaff.kitchenStation ? { kitchenStation: newStaff.kitchenStation } : {}),
        ...(newStaff.role === 'chef' && newStaff.kitchenPin ? { kitchenPin: newStaff.kitchenPin } : {}),
      });
      
      toast.success('Staff member added successfully!');
      setAddDialogOpen(false);
      setNewStaff({
        name: '',
        email: '',
        phone: '',
        role: 'waiter',
        shift: 'morning',
        department: 'service',
        salary: '',
        password: '',
        kitchenStation: '',
        kitchenPin: '',
      });
      fetchStaff();
    } catch (err) {
      console.error('Error adding staff:', err);
      toast.error('Failed to add staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (member: StaffMember) => {
    setSelectedStaff(member);
    setEditStaff({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      shift: member.shift,
      department: member.department || 'service',
      salary: member.salary?.toString() || '',
      password: '',
      kitchenStation: member.kitchenStation || '',
      kitchenPin: member.kitchenPin || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditStaff = async () => {
    if (!selectedStaff || !editStaff.name || !editStaff.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setSaving(true);
      await staffApi.update(selectedStaff._id, {
        name: editStaff.name,
        phone: editStaff.phone || undefined,
        role: editStaff.role,
        shift: editStaff.shift,
        department: editStaff.department,
        salary: editStaff.salary ? parseFloat(editStaff.salary) : undefined,
        ...(editStaff.password ? { password: editStaff.password } : {}),
        ...(editStaff.role === 'chef' ? { kitchenStation: editStaff.kitchenStation || null } : { kitchenStation: null }),
        ...(editStaff.role === 'chef' && editStaff.kitchenPin ? { kitchenPin: editStaff.kitchenPin } : {}),
      });
      
      toast.success('Staff member updated successfully!');
      setEditDialogOpen(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (err) {
      console.error('Error updating staff:', err);
      toast.error('Failed to update staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (member: StaffMember) => {
    setSelectedStaff(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff) return;

    try {
      setDeleting(true);
      await staffApi.delete(selectedStaff._id);
      toast.success('Staff member removed successfully!');
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (err) {
      console.error('Error deleting staff:', err);
      toast.error('Failed to remove staff member');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenPay = async (member: StaffMember) => {
    setPayStaff(member);
    setPayForm({
      amount: member.salary?.toString() || '',
      month: new Date().toISOString().slice(0, 7),
      paymentMethod: 'cash',
      notes: '',
    });
    setPayDialogOpen(true);
    setLoadingHistory(true);
    try {
      const history = await staffApi.getSalaryPayments(member._id);
      setPaymentHistory(history || []);
    } catch {
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePaySalary = async () => {
    if (!payStaff) return;
    const amount = parseFloat(payForm.amount);
    if (!payForm.amount || isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!payForm.month) {
      toast.error('Select a payment month');
      return;
    }
    try {
      setPaying(true);
      await staffApi.paySalary(payStaff._id, {
        amount,
        month: payForm.month,
        paymentMethod: payForm.paymentMethod,
        notes: payForm.notes || undefined,
      });
      toast.success(`₹${amount.toLocaleString('en-IN')} paid to ${payStaff.name}`);
      const history = await staffApi.getSalaryPayments(payStaff._id);
      setPaymentHistory(history || []);
      setPayForm(prev => ({ ...prev, notes: '' }));
    } catch {
      toast.error('Failed to record salary payment');
    } finally {
      setPaying(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params: { role?: string; active?: boolean; shift?: string } = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (shiftFilter !== 'all') params.shift = shiftFilter;
      
      const result = await staffApi.exportCsv(params);
      
      // Create and download CSV file
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'staff_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting staff:', err);
      setError('Failed to export staff data');
    } finally {
      setExporting(false);
    }
  };

  // Combine local and global search/filters
  const effectiveSearch = globalSearch || searchTerm;
  const effectiveRoleFilter = globalRoleFilter !== 'all' ? globalRoleFilter : roleFilter;
  const effectiveShiftFilter = globalShiftFilter !== 'all' ? globalShiftFilter : shiftFilter;

  const filteredStaff = staff.filter(s => {
    const matchesSearch = effectiveSearch === '' || 
      s.name.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      s.role.toLowerCase().includes(effectiveSearch.toLowerCase());
    
    const matchesRole = effectiveRoleFilter === 'all' || s.role === effectiveRoleFilter;
    const matchesShift = effectiveShiftFilter === 'all' || s.shift === effectiveShiftFilter;
    
    return matchesSearch && matchesRole && matchesShift;
  });

  const getShiftLabel = (shift: string) => {
    const shifts: Record<string, string> = {
      'morning': 'Morning (08:00 - 16:00)',
      'evening': 'Evening (16:00 - 00:00)',
      'night': 'Night (00:00 - 08:00)'
    };
    return shifts[shift] || shift;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Staff Management</h2>
          <p className="text-gray-300">Manage and monitor your restaurant team members and schedules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export Records
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#1A1A1A] hover:bg-black text-white px-6">
                <Plus className="h-4 w-4" />
                Add New Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
                <DialogDescription>
                  Enter the details of the new staff member below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Set login password (min 6 chars)"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={newStaff.role} 
                      onValueChange={(value) => setNewStaff({ ...newStaff, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="chef">Chef</SelectItem>
                        <SelectItem value="waiter">Waiter</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shift">Shift</Label>
                    <Select 
                      value={newStaff.shift} 
                      onValueChange={(value) => setNewStaff({ ...newStaff, shift: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (08:00 - 16:00)</SelectItem>
                        <SelectItem value="evening">Evening (16:00 - 00:00)</SelectItem>
                        <SelectItem value="night">Night (00:00 - 08:00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="department">Department</Label>
                    <Select 
                      value={newStaff.department} 
                      onValueChange={(value) => setNewStaff({ ...newStaff, department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kitchen">Kitchen</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="salary">Monthly Salary (₹)</Label>
                    <Input
                      id="salary"
                      type="number"
                      placeholder="Enter salary"
                      value={newStaff.salary}
                      onChange={(e) => setNewStaff({ ...newStaff, salary: e.target.value })}
                    />
                  </div>
                </div>
                {newStaff.role === 'chef' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3 mt-1">
                    <div className="grid gap-2">
                      <Label htmlFor="kitchenStation">Kitchen Station</Label>
                      <Select
                        value={newStaff.kitchenStation}
                        onValueChange={(value) => setNewStaff({ ...newStaff, kitchenStation: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select station" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FRY">🔥 Fry Station</SelectItem>
                          <SelectItem value="CURRY">🍛 Curry Station</SelectItem>
                          <SelectItem value="RICE">🍚 Rice Station</SelectItem>
                          <SelectItem value="PREP">🥗 Prep Station</SelectItem>
                          <SelectItem value="GRILL">🍖 Grill Station</SelectItem>
                          <SelectItem value="DESSERT">🍰 Dessert Station</SelectItem>
                          <SelectItem value="HEAD_CHEF">👑 Head Chef</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="kitchenPin">KDS Terminal PIN (4 digits)</Label>
                      <Input
                        id="kitchenPin"
                        type="password"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={newStaff.kitchenPin}
                        onChange={(e) => setNewStaff({ ...newStaff, kitchenPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      />
                      <p className="text-xs text-muted-foreground">Used to log in to the kitchen display terminal</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStaff} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Staff Member'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search staff by name, role, or ID..." 
                className="pl-10 bg-[#FDFCFB] border-none rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Role:</span>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[120px] bg-transparent border-none font-semibold text-gray-800">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="chef">Chef</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Shift:</span>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger className="w-[120px] bg-transparent border-none font-semibold text-gray-800">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FDFCFB]">
                <tr className="text-left text-gray-600 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100">
                  <th className="px-6 py-4">Staff ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Shift</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading staff data...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 font-medium">#{member._id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold text-xs border border-white shadow-sm">
                            {getInitials(member.name)}
                          </div>
                          <span className="font-semibold text-gray-800">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-none font-bold text-[10px] py-1 px-3">
                            {member.role?.toUpperCase()}
                          </Badge>
                          {member.role === 'chef' && member.kitchenStation && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] py-0.5 px-2">
                              {member.kitchenStation === 'HEAD_CHEF' ? '👑 Head Chef' : member.kitchenStation.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{getShiftLabel(member.shift)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${member.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={member.active ? 'text-green-600 font-medium' : 'text-gray-400 font-medium'}>
                            {member.active ? 'Active' : 'Off-duty'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            title="Pay Salary"
                            onClick={() => handleOpenPay(member)}
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                            onClick={() => handleOpenEdit(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => handleOpenDelete(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {loading ? 'Loading...' : `Showing 1 to ${filteredStaff.length} of ${staff.length} results`}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 rounded-lg bg-[#1A1A1A] text-white border-none p-0">1</Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg text-gray-400 p-0">2</Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg text-gray-400 p-0">3</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update the staff member's information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter full name"
                  value={editStaff.name}
                  onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email Address *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="Enter email"
                  value={editStaff.email}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="Enter phone"
                  value={editStaff.phone}
                  onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editStaff.role} onValueChange={(value) => setEditStaff({ ...editStaff, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="chef">Chef</SelectItem>
                        <SelectItem value="waiter">Waiter</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-shift">Shift</Label>
                <Select value={editStaff.shift} onValueChange={(value) => setEditStaff({ ...editStaff, shift: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (08:00 - 16:00)</SelectItem>
                    <SelectItem value="evening">Evening (16:00 - 00:00)</SelectItem>
                    <SelectItem value="night">Night (00:00 - 08:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select value={editStaff.department} onValueChange={(value) => setEditStaff({ ...editStaff, department: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-salary">Monthly Salary (₹)</Label>
                <Input
                  id="edit-salary"
                  type="number"
                  placeholder="Enter salary"
                  value={editStaff.salary}
                  onChange={(e) => setEditStaff({ ...editStaff, salary: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="edit-password">New Password <span className="text-gray-400 font-normal">(leave blank to keep unchanged)</span></Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Set new login password"
                value={editStaff.password}
                onChange={(e) => setEditStaff({ ...editStaff, password: e.target.value })}
              />
            </div>
            {editStaff.role === 'chef' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-kitchenStation">Kitchen Station</Label>
                  <Select
                    value={editStaff.kitchenStation}
                    onValueChange={(value) => setEditStaff({ ...editStaff, kitchenStation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FRY">🔥 Fry Station</SelectItem>
                      <SelectItem value="CURRY">🍛 Curry Station</SelectItem>
                      <SelectItem value="RICE">🍚 Rice Station</SelectItem>
                      <SelectItem value="PREP">🥗 Prep Station</SelectItem>
                      <SelectItem value="GRILL">🍖 Grill Station</SelectItem>
                      <SelectItem value="DESSERT">🎂 Dessert Station</SelectItem>
                      <SelectItem value="HEAD_CHEF">👑 Head Chef</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-kitchenPin">KDS Terminal PIN (4 digits)</Label>
                  <Input
                    id="edit-kitchenPin"
                    type="password"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={editStaff.kitchenPin}
                    onChange={(e) => setEditStaff({ ...editStaff, kitchenPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                  <p className="text-xs text-muted-foreground">Used to log in to the kitchen display terminal</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStaff} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open) setPaymentHistory([]); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Pay Salary — {payStaff?.name}</DialogTitle>
            <DialogDescription>
              Monthly salary: {payStaff?.salary ? `₹${payStaff.salary.toLocaleString('en-IN')}` : 'Not set'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="pay">
            <TabsList className="w-full">
              <TabsTrigger value="pay" className="flex-1">Pay Salary</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">Payment History</TabsTrigger>
            </TabsList>

            <TabsContent value="pay" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pay-amount">Amount (₹) *</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    placeholder="Enter amount"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-month">Month *</Label>
                  <Input
                    id="pay-month"
                    type="month"
                    value={payForm.month}
                    onChange={(e) => setPayForm({ ...payForm, month: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-method">Payment Method</Label>
                <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm({ ...payForm, paymentMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-notes">Notes</Label>
                <Textarea
                  id="pay-notes"
                  placeholder="Optional remarks..."
                  rows={2}
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
                <Button onClick={handlePaySalary} disabled={paying} className="bg-green-600 hover:bg-green-700 text-white">
                  {paying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                  ) : (
                    <><Wallet className="mr-2 h-4 w-4" />Confirm Payment</>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-2">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading history...</span>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Clock className="h-8 w-8" />
                  <p>No salary payments recorded yet</p>
                </div>
              ) : (
                <ScrollArea className="h-72">
                  <div className="space-y-2 pr-2">
                    {paymentHistory.map((p, i) => (
                      <div key={p._id || i} className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              ₹{Number(p.amount).toLocaleString('en-IN')}
                              <span className="ml-2 text-xs font-normal text-gray-500">{p.month}</span>
                            </p>
                            <p className="text-xs text-gray-400">
                              {p.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : p.paymentMethod === 'upi' ? 'UPI' : 'Cash'}
                              {p.notes && ` · ${p.notes}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold">{selectedStaff?.name}</span>? 
              This action cannot be undone and will permanently delete their record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
