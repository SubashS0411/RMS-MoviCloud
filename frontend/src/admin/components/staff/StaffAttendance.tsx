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
  Calendar as CalendarIcon,
  Clock,
  UserX,
  UserCheck,
  AlertCircle,
  Loader2,
  Wifi,
  ChevronDown,
  Users
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/admin/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { attendanceApi, staffApi } from '@/admin/utils/api';
import { toast } from 'sonner';

interface AttendanceRecord {
  _id: string;
  staffId: string;
  staffName: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  notes?: string;
}

interface StaffMember {
  _id: string;
  name: string;
  role: string;
  shift: string;
  phone?: string;
  department?: string;
  salary?: number;
}

interface OnlineUser {
  _id: string;
  name: string;
  role: string;
  department?: string;
  last_login: string;
}

interface AttendanceForm {
  staffId: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: string;
  notes: string;
}

interface StaffAttendanceProps {
  globalSearch?: string;
}

// Default shift timings (matching backend shift types)
const SHIFT_DEFAULTS: Record<string, { startTime: string; endTime: string }> = {
  morning:   { startTime: '08:00', endTime: '16:00' },
  afternoon: { startTime: '12:00', endTime: '20:00' },
  evening:   { startTime: '16:00', endTime: '00:00' },
  night:     { startTime: '22:00', endTime: '06:00' },
};

// Calculate hours between two times (handles overnight shifts)
const calculateHours = (start: string, end: string): number => {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let hours = (endH - startH) + (endM - startM) / 60;
  if (hours < 0) hours += 24; // Handle overnight (e.g., 22:00 to 06:00)
  return Math.round(hours * 10) / 10; // Round to 1 decimal
};

export function StaffAttendance({ globalSearch = '' }: StaffAttendanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(true);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceForm>({
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkIn: '',
    checkOut: '',
    hoursWorked: '',
    notes: ''
  });

  // Calculate stats from attendance data
  const activeOnSite = attendance.filter((a: AttendanceRecord) => a.status === 'present' || a.status === 'late').length;
  const totalStaff = staff.length || 46;
  const lateToday = attendance.filter((a: AttendanceRecord) => a.status === 'late').length;
  const absences = attendance.filter((a: AttendanceRecord) => a.status === 'absent').length;

  useEffect(() => {
    fetchData();
  }, [departmentFilter]);

  // Fetch online / recently-logged-in users; poll every 30 s
  const fetchOnlineUsers = async () => {
    try {
      const data = await staffApi.getOnline(30);
      setOnlineUsers(data || []);
    } catch {
      // silently ignore — non-critical
    } finally {
      setOnlineLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineUsers();
    const iv = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Auto-calculate hoursWorked whenever checkIn or checkOut changes in the form
  useEffect(() => {
    const { checkIn, checkOut } = attendanceForm;
    if (checkIn && checkOut) {
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      const diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff > 0) {
        setAttendanceForm(prev => ({ ...prev, hoursWorked: (diff / 60).toFixed(2) }));
      }
    }
  }, [attendanceForm.checkIn, attendanceForm.checkOut]);

  // Helper: format last_login as a relative string
  const formatLastSeen = (isoStr: string) => {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch attendance records
      const attendanceData = await attendanceApi.list({
        date_from: today,
        date_to: today
      });
      setAttendance(attendanceData || []);

      // Fetch all staff for reference
      const staffData = await staffApi.getAll();
      setStaff(staffData || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const result = await staffApi.exportAttendanceCsv();
      
      // Create and download CSV file
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'attendance_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting attendance:', err);
      setError('Failed to export attendance data');
    } finally {
      setExporting(false);
    }
  };

  const handleManualEntry = async () => {
    if (!attendanceForm.staffId || !attendanceForm.date) {
      toast.error('Please select a staff member and date');
      return;
    }

    try {
      setSaving(true);
      await attendanceApi.record({
        staffId: attendanceForm.staffId,
        date: attendanceForm.date,
        status: attendanceForm.status,
        checkIn: attendanceForm.checkIn || undefined,
        checkOut: attendanceForm.checkOut || undefined,
        hoursWorked: attendanceForm.hoursWorked ? parseFloat(attendanceForm.hoursWorked) : undefined,
        notes: attendanceForm.notes || undefined
      });
      
      toast.success('Attendance recorded successfully!');
      setManualEntryOpen(false);
      setAttendanceForm({
        staffId: '',
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        checkIn: '',
        checkOut: '',
        hoursWorked: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Error recording attendance:', err);
      toast.error('Failed to record attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStaffInfo = (staffId: string) => {
    const member = staff.find((s: StaffMember) => s._id === staffId);
    return member || { name: 'Unknown', role: 'N/A', shift: 'N/A' };
  };

  const openEditDialog = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setAttendanceForm({
      staffId: record.staffId,
      date: record.date,
      status: record.status || 'present',
      checkIn: record.checkIn || '',
      checkOut: record.checkOut || '',
      hoursWorked: record.hoursWorked?.toString() || '',
      notes: record.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditAttendance = async () => {
    if (!selectedRecord) return;

    try {
      setSaving(true);
      await attendanceApi.update(selectedRecord._id, {
        status: attendanceForm.status,
        checkIn: attendanceForm.checkIn || undefined,
        checkOut: attendanceForm.checkOut || undefined,
        hoursWorked: attendanceForm.hoursWorked ? parseFloat(attendanceForm.hoursWorked) : undefined,
        notes: attendanceForm.notes || undefined
      });
      
      toast.success('Attendance updated successfully!');
      setEditDialogOpen(false);
      setSelectedRecord(null);
      fetchData();
    } catch (err) {
      console.error('Error updating attendance:', err);
      toast.error('Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleInlineStatusChange = async (record: AttendanceRecord, newStatus: string) => {
    try {
      await attendanceApi.update(record._id, { status: newStatus });
      setAttendance(prev =>
        prev.map(a => a._id === record._id ? { ...a, status: newStatus } : a)
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    }
  };

  const handleBulkMarkPresent = async () => {
    const today = new Date().toISOString().split('T')[0];
    const alreadyRecordedIds = new Set(attendance.map(a => a.staffId));
    const unmarked = staff.filter(s => !alreadyRecordedIds.has(s._id));

    if (unmarked.length === 0) {
      toast.info('All staff already have attendance recorded for today');
      return;
    }

    try {
      setBulkMarking(true);
      const records = unmarked.map(s => {
        // Get shift timing based on staff's shift type
        const shiftKey = s.shift?.toLowerCase() || 'morning';
        const shiftTiming = SHIFT_DEFAULTS[shiftKey] || SHIFT_DEFAULTS.morning;
        const hoursWorked = calculateHours(shiftTiming.startTime, shiftTiming.endTime);
        
        return {
          staffId: s._id,
          date: today,
          status: 'present',
          checkIn: shiftTiming.startTime,
          checkOut: shiftTiming.endTime,
          hoursWorked: hoursWorked,
          notes: `Auto-marked with ${s.shift || 'default'} shift timing`
        };
      });
      const result = await attendanceApi.bulkMark(records);
      toast.success(`Marked ${result.upserted} staff as Present with shift timings`);
      fetchData();
    } catch (err) {
      console.error('Error bulk marking attendance:', err);
      toast.error('Failed to bulk mark attendance');
    } finally {
      setBulkMarking(false);
    }
  };

  // Combine local and global search
  const effectiveSearch = globalSearch || searchTerm;
  
  const filteredAttendance = attendance.filter((record: AttendanceRecord) => 
    effectiveSearch === '' || record.staffName?.toLowerCase().includes(effectiveSearch.toLowerCase())
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Attendance Tracking</h2>
          <p className="text-gray-300">Real-time staff monitoring and shift verification.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-white text-[#8B5E34] border-white hover:bg-gray-100 font-semibold"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarIcon className="h-4 w-4" />}
            Export
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-white text-[#8B5E34] border-white hover:bg-gray-100 font-semibold"
            onClick={handleBulkMarkPresent}
            disabled={bulkMarking}
          >
            {bulkMarking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Mark All Present
          </Button>
          <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#1A1A1A] hover:bg-black text-white px-6">
                <Plus className="h-4 w-4" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Manual Attendance Entry</DialogTitle>
                <DialogDescription>
                  Record attendance for a staff member manually.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="staff">Staff Member *</Label>
                  <Select 
                    value={attendanceForm.staffId} 
                    onValueChange={(value) => setAttendanceForm({ ...attendanceForm, staffId: value })}
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
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={attendanceForm.status} 
                    onValueChange={(value) => setAttendanceForm({ ...attendanceForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="half-day">Half Day</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="checkIn">Clock In Time</Label>
                    <Input
                      id="checkIn"
                      type="time"
                      value={attendanceForm.checkIn}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="checkOut">Clock Out Time</Label>
                    <Input
                      id="checkOut"
                      type="time"
                      value={attendanceForm.checkOut}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hoursWorked">Hours Worked <span className="text-xs text-muted-foreground">(auto-calculated)</span></Label>
                  <Input
                    id="hoursWorked"
                    type="number"
                    step="0.5"
                    placeholder="Auto-filled from times"
                    value={attendanceForm.hoursWorked}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, hoursWorked: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    placeholder="Optional notes"
                    value={attendanceForm.notes}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setManualEntryOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualEntry} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Record Attendance'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Currently Online Users */}
      <Card className="border-none shadow-sm bg-white rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Wifi className="h-5 w-5 text-green-500" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">Currently Online</h3>
            </div>
            <Badge className="bg-green-50 text-green-600 border-none font-bold text-[11px] px-3">
              {onlineLoading ? '…' : onlineUsers.length} active
            </Badge>
          </div>
          {onlineLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : onlineUsers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No staff currently online</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {onlineUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 min-w-[180px]"
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center text-green-700 font-bold text-xs shadow-sm">
                      {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 border-2 border-white rounded-full" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{user.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{user.role}</div>
                    <div className="text-[10px] text-green-600 font-semibold mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatLastSeen(user.last_login)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-bold text-white-600 uppercase tracking-widest mb-1">Active On-Site</p>
                {onlineLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                ) : (
                  <div className="text-4xl font-bold text-[#2D2D2D]">{onlineUsers.length}/{totalStaff}</div>
                )}
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  {onlineUsers.length} logged in now
                </p>
              </div>
              <Badge className="bg-green-50 text-green-600 border-none font-bold text-[10px]">+5.2%</Badge>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <motion.div 
                className="bg-green-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: totalStaff > 0 ? `${(onlineUsers.length / totalStaff) * 100}%` : '0%' }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">Late Today</p>
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                ) : (
                  <div className="text-4xl font-bold text-[#2D2D2D]">{lateToday}</div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Pending review: <span className="font-semibold text-gray-700">1</span></p>
              </div>
              <div className="bg-orange-50 text-orange-600 rounded-full h-8 w-8 flex items-center justify-center font-bold text-xs">-2</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">Absences</p>
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                ) : (
                  <div className="text-4xl font-bold text-[#2D2D2D]">{absences}</div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Unexcused this week: <span className="font-semibold text-gray-700">2</span></p>
              </div>
              <div className="text-red-600 font-bold text-xl">{absences}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="bg-[#FDFCFB] border border-gray-100 px-3 py-2 rounded-xl flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">24-10-2024</span>
                <CalendarIcon className="h-4 w-4 text-gray-400" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px] bg-[#FDFCFB] border-none rounded-xl text-sm font-medium">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by name..." 
                className="pl-10 bg-[#FDFCFB] border-none rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FDFCFB]">
                <tr className="text-left text-gray-600 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Shift</th>
                  <th className="px-6 py-4">Clock In</th>
                  <th className="px-6 py-4">Clock Out</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Pay</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading attendance data...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((record: AttendanceRecord) => {
                    const staffInfo = getStaffInfo(record.staffId);
                    const status = record.status?.toUpperCase() || 'ABSENT';
                    const clockInStatus = record.checkIn ? (new Date(`2000-01-01T${record.checkIn}`) < new Date('2000-01-01T08:00:00') ? 'EARLY' : 'ON TIME') : '';
                    
                    // Calculate hourly rate from staff salary (salary / 30 days / 8 hours)
                    const hourlyRate = ((staffInfo as any).salary || 30000) / 30 / 8;
                    const earnedAmount = (record.hoursWorked || 0) * hourlyRate;
                    
                    return (
                      <tr key={record._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold text-xs border border-white shadow-sm">
                              {staffInfo.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-bold text-gray-800">{staffInfo.name}</div>
                              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{staffInfo.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-medium">{staffInfo.shift}</td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-gray-800">{record.checkIn || '--:--'}</div>
                            {clockInStatus && (
                              <div className={`text-[9px] font-bold uppercase tracking-tighter ${clockInStatus === 'EARLY' ? 'text-green-500' : 'text-orange-500'}`}>
                                {clockInStatus}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-800 font-medium">{record.checkOut || '--:--'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="bg-white border border-gray-200 px-3 py-1 rounded-md font-bold text-gray-800 w-14 text-center">
                              {record.hoursWorked || '0'}
                            </div>
                            <span className="text-gray-400 text-xs font-medium">hrs</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-green-600">₹{Math.round(earnedAmount).toLocaleString('en-IN')}</div>
                            <div className="text-[10px] font-bold text-gray-400">₹{Math.round(hourlyRate).toLocaleString('en-IN')}/hr</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 focus:outline-none">
                                <Badge className={`border-none font-bold text-[10px] px-3 py-1 ${
                                  status === 'PRESENT' ? 'bg-green-50 text-green-600' : 
                                  status === 'LATE' ? 'bg-orange-50 text-orange-600' :
                                  status === 'HALF_DAY' ? 'bg-yellow-50 text-yellow-600' :
                                  status === 'LEAVE' ? 'bg-blue-50 text-blue-600' :
                                  'bg-red-50 text-red-600'
                                }`}>
                                  {status}
                                </Badge>
                                <ChevronDown className="h-3 w-3 text-gray-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              {(['present','late','absent','half_day','leave'] as const).map(s => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => handleInlineStatusChange(record, s)}
                                  className="capitalize text-xs font-semibold"
                                >
                                  {s.replace('_', ' ')}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                            onClick={() => openEditDialog(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Attendance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Update attendance record for a staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Staff Member</Label>
              <Input value={selectedRecord?.staffName || ''} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select 
                value={attendanceForm.status} 
                onValueChange={(value) => setAttendanceForm({ ...attendanceForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Clock In Time</Label>
                <Input
                  type="time"
                  value={attendanceForm.checkIn}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Clock Out Time</Label>
                <Input
                  type="time"
                  value={attendanceForm.checkOut}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Hours Worked <span className="text-xs text-muted-foreground">(auto-calculated)</span></Label>
              <Input
                type="number"
                step="0.5"
                placeholder="Auto-filled from times"
                value={attendanceForm.hoursWorked}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, hoursWorked: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={attendanceForm.notes}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAttendance} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update Attendance'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
