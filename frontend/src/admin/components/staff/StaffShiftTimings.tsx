import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/admin/components/ui/card";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { Badge } from "@/admin/components/ui/badge";
import { Checkbox } from "@/admin/components/ui/checkbox";
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/admin/components/ui/select";
import { Clock, TrendingUp, Info, Loader2, Plus, Pencil, Trash2, DollarSign, CheckCircle, CalendarClock } from 'lucide-react';
import { shiftsApi, staffApi, settingsApi } from '@/admin/utils/api';
import { toast } from 'sonner';

const mockRoster = [
  { 
    id: 1, 
    name: 'Jonathan Doe', 
    role: 'HEAD CHEF', 
    rate: '₹4,460/h', 
    baseRate: '₹4,460.00/h',
    otMultiplier: '1.5x',
    startTime: '08:00 AM',
    endTime: '06:00 PM',
    adjustment: '0',
    totalHours: '10.0',
    otPay: '₹13,380.00'
  },
  { 
    id: 2, 
    name: 'Maria Garcia', 
    role: 'LEAD SERVER', 
    rate: '₹1,680/h', 
    baseRate: '₹1,680.00/h',
    otMultiplier: '1.5x',
    startTime: '10:00 AM',
    endTime: '06:00 PM',
    adjustment: '2',
    totalHours: '10.0',
    otPay: '₹5,040.00'
  },
  { 
    id: 3, 
    name: 'Michael Chen', 
    role: 'SOUS CHEF', 
    rate: '₹2,835/h', 
    baseRate: '₹2,835.00/h',
    otMultiplier: '1.5x',
    startTime: '02:00 PM',
    endTime: '11:00 PM',
    adjustment: '0',
    totalHours: '9.0',
    otPay: '₹4,252.50'
  },
  { 
    id: 4, 
    name: 'Sarah Wilson', 
    role: 'JUNIOR SERVER', 
    rate: '₹1,470/h', 
    baseRate: '₹1,470.00/h',
    otMultiplier: '1.5x',
    startTime: '04:00 PM',
    endTime: '12:00 AM',
    adjustment: '0',
    totalHours: '8.0',
    otPay: '₹0.00 Extra'
  },
];

// Default times for each shift type (mirrors backend ShiftType enum)
const SHIFT_DEFAULTS: Record<string, { startTime: string; endTime: string; label: string }> = {
  morning:   { startTime: '08:00', endTime: '16:00', label: 'Morning' },
  afternoon: { startTime: '12:00', endTime: '20:00', label: 'Afternoon' },
  evening:   { startTime: '16:00', endTime: '00:00', label: 'Evening' },
  night:     { startTime: '22:00', endTime: '06:00', label: 'Night' },
};

interface ShiftAssignment {
  _id: string;
  staffId: string;
  staffName: string;
  shiftType: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  /** true when derived from staff profile – not yet saved as a real assignment */
  isDefault?: boolean;
  /** set by the backend after publish */
  published?: boolean;
  publishedAt?: string;
}

interface StaffMember {
  _id: string;
  name: string;
  role: string;
  shift: string;
  salary?: number;
}

interface StaffShiftTimingsProps {
  globalSearch?: string;
}

interface ShiftForm {
  staffId: string;
  date: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export function StaffShiftTimings({ globalSearch = '' }: StaffShiftTimingsProps) {
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [ratesDialogOpen, setRatesDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftAssignment | null>(null);
  const [rateMode, setRateMode] = useState<'standard' | 'weekend' | 'holiday'>('standard');
  const [shiftForm, setShiftForm] = useState<ShiftForm>({
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    shiftType: 'morning',
    startTime: '08:00',
    endTime: '16:00',
    notes: ''
  });

  // Store custom rates per staff member
  const [staffRates, setStaffRates] = useState<Record<string, { baseRate: number; otMultiplier: number }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Fetch shifts for this week and all staff in parallel
      const [shiftsData, staffData] = await Promise.all([
        shiftsApi.list({ date_from: today, date_to: nextWeek.toISOString().split('T')[0] }),
        staffApi.getAll()
      ]);

      const realShifts: ShiftAssignment[] = shiftsData || [];
      const allStaff: StaffMember[] = staffData || [];

      // Derive default shift rows for staff with no explicit assignment this week
      const assignedStaffIds = new Set(realShifts.map((s: ShiftAssignment) => s.staffId));
      const defaultShifts: ShiftAssignment[] = allStaff
        .filter((s: StaffMember) => !assignedStaffIds.has(s._id) && s.shift && SHIFT_DEFAULTS[s.shift])
        .map((s: StaffMember) => {
          const defaults = SHIFT_DEFAULTS[s.shift];
          return {
            _id: `__default__${s._id}`,
            staffId: s._id,
            staffName: s.name,
            shiftType: s.shift,
            date: today,
            startTime: defaults.startTime,
            endTime: defaults.endTime,
            isDefault: true,
          };
        });

      setShifts([...realShifts, ...defaultShifts]);
      setStaff(allStaff);
    } catch (err) {
      console.error('Error fetching shift data:', err);
      setError('Failed to load shift data');
    } finally {
      setLoading(false);
    }
  };

  const getStaffInfo = (staffId: string) => {
    return staff.find((s: StaffMember) => s._id === staffId) || { name: 'Unknown', role: 'N/A', salary: 0 };
  };

  const formatTime = (time: string) => {
    if (!time) return '--:--';
    return time;
  };

  const calculateHours = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return '0';
    try {
      const [start] = startTime.split(' ');
      const [end] = endTime.split(' ');
      const startDate = new Date(`2000-01-01T${start}`);
      const endDate = new Date(`2000-01-01T${end}`);
      const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      return hours > 0 ? hours.toFixed(1) : (hours + 24).toFixed(1);
    } catch {
      return '0';
    }
  };

  const handleAddShift = async () => {
    if (!shiftForm.staffId || !shiftForm.date) {
      toast.error('Please select a staff member and date');
      return;
    }

    try {
      setSaving(true);
      await shiftsApi.create({
        staffId: shiftForm.staffId,
        shiftType: shiftForm.shiftType,
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        notes: shiftForm.notes || undefined
      });
      
      toast.success('Shift added successfully!');
      setAddDialogOpen(false);
      setShiftForm({
        staffId: '',
        date: new Date().toISOString().split('T')[0],
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '16:00',
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Error adding shift:', err);
      toast.error('Failed to add shift');
    } finally {
      setSaving(false);
    }
  };

  const handleEditShift = async () => {
    if (!selectedShift) return;

    try {
      setSaving(true);
      // Delete the old shift and create a new one
      await shiftsApi.delete(selectedShift._id);
      await shiftsApi.create({
        staffId: selectedShift.staffId,
        shiftType: shiftForm.shiftType,
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        notes: shiftForm.notes || undefined
      });
      
      toast.success('Shift updated successfully!');
      setEditDialogOpen(false);
      setSelectedShift(null);
      fetchData();
    } catch (err) {
      console.error('Error updating shift:', err);
      toast.error('Failed to update shift');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await shiftsApi.delete(shiftId);
      toast.success('Shift deleted successfully!');
      fetchData();
    } catch (err) {
      console.error('Error deleting shift:', err);
      toast.error('Failed to delete shift');
    }
  };

  const openEditDialog = (shift: ShiftAssignment) => {
    if (shift.isDefault) {
      // Pre-fill Add Shift dialog so saving creates a real assignment
      const defaults = SHIFT_DEFAULTS[shift.shiftType] || { startTime: shift.startTime, endTime: shift.endTime };
      setShiftForm({
        staffId: shift.staffId,
        date: shift.date,
        shiftType: shift.shiftType,
        startTime: defaults.startTime,
        endTime: defaults.endTime,
        notes: ''
      });
      setAddDialogOpen(true);
      return;
    }
    setSelectedShift(shift);
    setShiftForm({
      staffId: shift.staffId,
      date: shift.date,
      shiftType: shift.shiftType || 'morning',
      startTime: shift.startTime,
      endTime: shift.endTime,
      notes: shift.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handlePublishRoster = async () => {
    // Only real (non-default) unpublished shifts can be published
    const unpublished = shifts.filter(s => !s.isDefault && !s.published);
    if (unpublished.length === 0) {
      toast.info('No unpublished shifts to publish. Add shifts first.');
      return;
    }

    try {
      setPublishing(true);

      // 1. Save rate settings
      await Promise.all([
        settingsApi.upsert({ key: 'shift_rate_mode', value: rateMode, category: 'shifts' }),
        settingsApi.upsert({ key: 'staff_rates', value: staffRates, category: 'shifts' }),
      ]);

      // 2. Publish roster — marks shifts as locked + sends notifications
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const result = await shiftsApi.publish({
        date_from: today,
        date_to: nextWeek.toISOString().split('T')[0],
      });

      if (result.message) {
        toast.info(result.message);
      } else {
        toast.success(
          `✅ Roster published! ${result.published} shift(s) locked · ${result.notified} staff notified.`
        );
      }

      // 3. Refresh so published badges appear
      fetchData();
    } catch (err) {
      console.error('Error publishing roster:', err);
      toast.error('Failed to publish roster');
    } finally {
      setPublishing(false);
    }
  };

  const handleRateModeChange = (mode: 'standard' | 'weekend' | 'holiday') => {
    setRateMode(mode);
  };

  // Filter shifts by global search
  const filteredShifts = globalSearch 
    ? shifts.filter((shift: ShiftAssignment) => {
        const staffInfo = getStaffInfo(shift.staffId);
        return staffInfo.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
               staffInfo.role.toLowerCase().includes(globalSearch.toLowerCase());
      })
    : shifts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Shift Timings & Allocation</h2>
          <p className="text-gray-300">Manage mandatory shifts and customize financial rates per employee.</p>
        </div>
        <div className="flex items-center gap-3">
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A1A1A] hover:bg-black text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Shift
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Shift</DialogTitle>
              <DialogDescription>
                Assign a shift to a staff member.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Staff Member *</Label>
                <Select 
                  value={shiftForm.staffId} 
                  onValueChange={(value) => setShiftForm({ ...shiftForm, staffId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} ({s.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Shift Type</Label>
                <Select 
                  value={shiftForm.shiftType} 
                  onValueChange={(value) => setShiftForm({ ...shiftForm, shiftType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (08:00 - 16:00)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12:00 - 20:00)</SelectItem>
                    <SelectItem value="evening">Evening (16:00 - 00:00)</SelectItem>
                    <SelectItem value="night">Night (00:00 - 08:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddShift} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Shift
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Shift</DialogTitle>
              <DialogDescription>
                Update the shift details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Staff Member</Label>
                <Input value={selectedShift?.staffName || ''} disabled />
              </div>
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Shift Type</Label>
                <Select 
                  value={shiftForm.shiftType} 
                  onValueChange={(value) => setShiftForm({ ...shiftForm, shiftType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (08:00 - 16:00)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12:00 - 20:00)</SelectItem>
                    <SelectItem value="evening">Evening (16:00 - 00:00)</SelectItem>
                    <SelectItem value="night">Night (00:00 - 08:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditShift} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update Shift
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="bg-[#1A1A1A] text-white rounded-xl p-1 flex items-center shadow-lg">
          <div className="bg-[#8B5A2B] px-3 py-2 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[10px] font-bold tracking-tighter leading-none">RATE</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-start leading-tight">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">Global Mode</span>
            <span className="text-sm font-semibold">Standard View</span>
          </div>
        </div>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FDFCFB]/50">
                <tr className="text-left text-gray-600 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100">
                  <th className="px-6 py-4 w-12 text-center">
                    <Checkbox className="rounded" />
                  </th>
                  <th className="px-6 py-4">Employee & Rates</th>
                  <th className="px-6 py-4">Financials</th>
                  <th className="px-6 py-4">Shift Allocation</th>
                  <th className="px-6 py-4">Admin Adjustment</th>
                  <th className="px-6 py-4 text-right">Payroll Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading shift data...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      {globalSearch ? 'No matching shifts found' : 'No shifts scheduled for this week'}
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift: ShiftAssignment) => {
                    const staffInfo = getStaffInfo(shift.staffId);
                    const hourlyRate = (staffInfo.salary || 30000) / 30 / 8;
                    const totalHours = calculateHours(shift.startTime, shift.endTime);
                    const regularHours = Math.min(parseFloat(totalHours), 8);
                    const otHours = Math.max(0, parseFloat(totalHours) - 8);
                    const otPay = otHours * hourlyRate * 1.5;
                    
                    return (
                      <tr key={shift._id} className={`hover:bg-gray-50/50 transition-colors ${shift.isDefault ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-6 py-6 text-center">
                          <Checkbox className="rounded" />
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs border border-white shadow-sm">
                              {staffInfo.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-bold text-gray-800">{staffInfo.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{staffInfo.role}</span>
                                <Badge className="bg-orange-50 text-orange-600 border-none font-bold text-[9px] px-2 py-0">RATE: ₹{Math.round(hourlyRate)}/h</Badge>
                                {shift.isDefault && (
                                  <Badge className="bg-blue-50 text-blue-500 border-none font-bold text-[9px] px-2 py-0 flex items-center gap-1">
                                    <CalendarClock className="h-2.5 w-2.5" />
                                    Default Shift
                                  </Badge>
                                )}
                                {shift.published && (
                                  <Badge className="bg-green-50 text-green-600 border-none font-bold text-[9px] px-2 py-0 flex items-center gap-1">
                                    <CheckCircle className="h-2.5 w-2.5" />
                                    Published
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div>
                            <div className="font-bold text-gray-800">Base: ₹{hourlyRate.toFixed(2)}/h</div>
                            <div className="text-[10px] font-bold text-gray-400">OT Multiplier: 1.5x</div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 font-bold text-gray-700 w-32 justify-between">
                              <span>{formatTime(shift.startTime)}</span>
                              <Clock className="h-3 w-3 text-gray-400" />
                            </div>
                            <span className="text-gray-300">→</span>
                            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 font-bold text-gray-700 w-32 justify-between">
                              <span>{formatTime(shift.endTime)}</span>
                              <Clock className="h-3 w-3 text-gray-400" />
                            </div>
                            {shift.isDefault && (
                              <span className="text-[10px] text-blue-400 font-semibold capitalize">{SHIFT_DEFAULTS[shift.shiftType]?.label}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg font-bold text-gray-800 w-16 text-center">
                              0
                            </div>
                            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Hours</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div>
                            <div className="font-bold text-[#8B5A2B] text-base">{totalHours} Total Hours</div>
                            <div className={`text-xs font-bold ${otPay > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                              {otPay > 0 ? `+ ₹${otPay.toFixed(2)} OT Pay` : 'No OT Pay'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                              onClick={() => openEditDialog(shift)}
                              title={shift.isDefault ? 'Assign shift (save as real schedule)' : 'Edit shift'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!shift.isDefault && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-8 w-8 ${shift.published ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                                onClick={() => {
                                  if (shift.published) {
                                    toast.warning('This shift is published and locked. Unpublish the roster to edit.');
                                    return;
                                  }
                                  handleDeleteShift(shift._id);
                                }}
                                title={shift.published ? 'Locked – roster is published' : 'Delete shift'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-[#FDFCFB]/30">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-400" />
                <p className="text-xs text-muted-foreground font-medium">Auto-calculation engine active based on mandatory shifts.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <p className="text-xs text-muted-foreground font-medium">Blue rows = staff default shift (from profile). Click <Pencil className="inline h-3 w-3" /> to save as a real assignment.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="text-black border border-gray-300 hover:border-gray-400 hover:text-black font-bold uppercase tracking-widest text-[11px] px-6"
                onClick={() => setRatesDialogOpen(true)}
              >
                Modify Financial Rates
              </Button>
              <Button 
                className="bg-[#1A1A1A] hover:bg-black text-white px-8 py-6 rounded-xl font-bold uppercase tracking-widest text-[11px]"
                onClick={handlePublishRoster}
                disabled={publishing}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publish Roster
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modify Financial Rates Dialog */}
      <Dialog open={ratesDialogOpen} onOpenChange={setRatesDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Modify Financial Rates</DialogTitle>
            <DialogDescription>
              Set hourly rates and overtime multipliers for staff members.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Rate Mode</Label>
              <Select value={rateMode} onValueChange={(v) => handleRateModeChange(v as 'standard' | 'weekend' | 'holiday')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (1.0x OT)</SelectItem>
                  <SelectItem value="weekend">Weekend (1.5x OT)</SelectItem>
                  <SelectItem value="holiday">Holiday (2.0x OT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-2 block">Individual Staff Rates</Label>
              {staff.map((s) => (
                <div key={s._id} className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center mb-3">
                  <span className="text-sm truncate">{s.name}</span>
                  <Input
                    type="number"
                    placeholder="Base Rate"
                    value={staffRates[s._id]?.baseRate || ''}
                    onChange={(e) => setStaffRates({
                      ...staffRates,
                      [s._id]: { ...staffRates[s._id], baseRate: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="OT Multiplier"
                    value={staffRates[s._id]?.otMultiplier || ''}
                    onChange={(e) => setStaffRates({
                      ...staffRates,
                      [s._id]: { ...staffRates[s._id], otMultiplier: parseFloat(e.target.value) || 1.5 }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRatesDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setRatesDialogOpen(false);
              toast.success('Rates saved successfully!');
            }}>
              Save Rates
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
