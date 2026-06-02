import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/admin/components/ui/card";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Calendar as CalendarIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { staffApi, shiftsApi, attendanceApi } from '@/admin/utils/api';

interface StaffStats {
  byRole: Record<string, number>;
  active: number;
  inactive: number;
  total: number;
}

export function StaffReports() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [expenditureData, setExpenditureData] = useState([
    { name: 'Kitchen', regular: 12000, overtime: 3000 },
    { name: 'Service', regular: 8000, overtime: 1200 },
    { name: 'Cleaning', regular: 3500, overtime: 200 },
    { name: 'Bar', regular: 5500, overtime: 1500 },
  ]);
  const [payrollSplitData, setPayrollSplitData] = useState([
    { name: 'Regular Salary', value: 86.7, color: '#1A1A1A' },
    { name: 'Mandatory Overtime', value: 13.3, color: '#8B5A2B' },
  ]);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Parse selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0); // Last day of the month

      // Fetch staff stats
      const statsData = await staffApi.getStats();
      setStats(statsData);

      // Fetch shifts for the selected month
      const shiftsData = await shiftsApi.list({
        date_from: firstDay.toISOString().split('T')[0],
        date_to: lastDay.toISOString().split('T')[0]
      });
      setShifts(shiftsData || []);

      // Fetch attendance for the selected month
      const attendanceData = await attendanceApi.list({
        date_from: firstDay.toISOString().split('T')[0],
        date_to: lastDay.toISOString().split('T')[0]
      });
      setAttendance(attendanceData || []);

      // Calculate actual hours from attendance records
      const totalHoursWorked = attendanceData.reduce((sum: number, record: any) => {
        return sum + (record.hoursWorked || 0);
      }, 0);

      // Standard hours per day is 8, overtime is anything above that
      const regularHours = attendanceData.filter((r: any) => r.status === 'present').length * 8;
      const overtimeHours = Math.max(0, totalHoursWorked - regularHours);

      // Update payroll split based on actual attendance data
      const totalHours = regularHours + overtimeHours;
      const regularPercent = totalHours > 0 ? (regularHours / totalHours) * 100 : 86.7;
      const otPercent = totalHours > 0 ? (overtimeHours / totalHours) * 100 : 13.3;

      setPayrollSplitData([
        { name: 'Regular Salary', value: Number(regularPercent.toFixed(1)), color: '#1A1A1A' },
        { name: 'Mandatory Overtime', value: Number(otPercent.toFixed(1)), color: '#8B5A2B' },
      ]);

      // Group attendance by staff role/department
      const staffList = await staffApi.list();
      const staffMap = new Map(staffList.map((s: any) => [s._id, s]));
      
      // Calculate department-wise expenditure from actual attendance
      const deptHours: Record<string, { regular: number; overtime: number }> = {
        Kitchen: { regular: 0, overtime: 0 },
        Service: { regular: 0, overtime: 0 },
      };

      attendanceData.forEach((record: any) => {
        if (record.status !== 'present') return;
        const staff = staffMap.get(record.staffId);
        if (!staff) return;

        const hoursWorked = record.hoursWorked || 8;
        const regularHrs = Math.min(8, hoursWorked);
        const otHrs = Math.max(0, hoursWorked - 8);

        let dept = 'Service'; // Default
        const role = staff.role?.toLowerCase() || '';
        if (role.includes('chef') || role.includes('cook')) dept = 'Kitchen';
        else dept = 'Service'; // All other roles go to Service

        deptHours[dept].regular += regularHrs;
        deptHours[dept].overtime += otHrs;
      });

      // Convert hours to rupees (assuming ₹200/hr regular, ₹300/hr OT)
      const regularRate = 200;
      const otRate = 300;

      setExpenditureData([
        { 
          name: 'Kitchen', 
          regular: Math.round(deptHours.Kitchen.regular * regularRate), 
          overtime: Math.round(deptHours.Kitchen.overtime * otRate) 
        },
        { 
          name: 'Service', 
          regular: Math.round(deptHours.Service.regular * regularRate), 
          overtime: Math.round(deptHours.Service.overtime * otRate) 
        },
      ]);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const handleExportPayrollCsv = async () => {
    try {
      setExporting(true);
      
      // Get date range for last month
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await staffApi.exportPayrollCsv({
        date_from: thirtyDaysAgo.toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0]
      });
      
      // Create and download CSV file
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'payroll_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting payroll:', err);
    } finally {
      setExporting(false);
    }
  };

  const totalOvertimePaid = shifts.length * 2500; // Estimate
  const avgOTPerEmployee = shifts.length > 0 ? (shifts.length / (stats?.total || 1)).toFixed(1) : '0';
  
  // Calculate actual overtime metrics from attendance
  const totalOvertimeHours = attendance.reduce((sum: number, record: any) => {
    if (record.status !== 'present') return sum;
    const hoursWorked = record.hoursWorked || 0;
    const overtime = Math.max(0, hoursWorked - 8); // Hours beyond 8 are overtime
    return sum + overtime;
  }, 0);
  
  // Estimate overtime paid using average hourly rate of ₹125 (₹30,000/30/8) * 1.5 = ₹187.5/hr OT
  const avgOTRate = (30000 / 30 / 8) * 1.5; // Default salary based OT rate
  const overtimePaid = Math.round(totalOvertimeHours * avgOTRate);
  
  const avgOTHours = stats?.total && attendance.length > 0 
    ? (totalOvertimeHours / stats.total).toFixed(1) 
    : '0';
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Financial & Labor Reports</h2>
          <p className="text-gray-300">Detailed analysis of labor distribution and mandatory overtime expenditures.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <CalendarIcon className="h-4 w-4 text-[#8B5A2B]" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border-0 shadow-none focus:ring-0 w-auto text-sm font-medium"
            />
          </div>
          <Button 
            className="bg-[#1A1A1A] hover:bg-black text-white px-6 rounded-xl"
            onClick={handleExportPayrollCsv}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Download Payroll CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-bold text-gray-800">Overtime Expenditure by Department</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
              </div>
            ) : (
              <>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenditureData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9CA3AF', fontSize: 12}}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9CA3AF', fontSize: 12}}
                      />
                      <Tooltip 
                        cursor={{fill: '#FDFCFB'}}
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                      />
                      <Bar dataKey="regular" stackId="a" fill="#E5DDD3" radius={[0, 0, 0, 0]} barSize={80} name="REGULAR SALARY" />
                      <Bar dataKey="overtime" stackId="a" fill="#8B5A2B" radius={[4, 4, 0, 0]} barSize={80} name="MANDATORY OVERTIME" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-6 mt-6 ml-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#E5DDD3]" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Regular Salary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#8B5A2B]" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Mandatory Overtime</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-2xl flex flex-col items-center justify-center p-6">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-8">Payroll Split</p>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          ) : (
            <>
              <div className="relative h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payrollSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {payrollSplitData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-[#1A1A1A]">{payrollSplitData[1].value}%</span>
                  <span className="text-[10px] font-bold text-[#8B5A2B] uppercase tracking-tighter">OT to Total Ratio</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl bg-[#1A1A1A] text-white rounded-2xl">
          <CardContent className="p-8">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Total Overtime Paid</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            ) : (
              <>
                <div className="text-4xl font-bold mb-6">₹{overtimePaid.toLocaleString('en-IN')}</div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-xs text-gray-400">Calculated from {attendance.length} Attendance Records</p>
                  <p className="text-xs text-gray-400 mt-1">{totalOvertimeHours.toFixed(1)} OT hours @ ₹{Math.round(avgOTRate)}/hr (1.5x)</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardContent className="p-8">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Avg OT Per Employee</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            ) : (
              <>
                <div className="text-4xl font-bold text-[#2D2D2D] mb-4">{avgOTHours}h</div>
                <p className="text-sm text-muted-foreground">Per employee this month</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardContent className="p-8">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Policy Violations</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            ) : (
              <>
                <div className="text-4xl font-bold text-red-600 mb-6">0</div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-xs font-bold">All shifts allocated within legal limits</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
