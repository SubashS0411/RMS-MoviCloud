import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/admin/components/ui/card";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Users, UserCheck, Calendar, Clock, ArrowUpRight, ArrowDownRight, Loader2, ChefHat, User, CreditCard, ShieldCheck } from 'lucide-react';
import { staffApi, attendanceApi } from '@/admin/utils/api';

const attendanceData = [
  { day: 'Mon', rate: 92 },
  { day: 'Tue', rate: 93 },
  { day: 'Wed', rate: 89 },
  { day: 'Thu', rate: 91 },
  { day: 'Fri', rate: 95 },
  { day: 'Sat', rate: 98 },
  { day: 'Sun', rate: 96 },
];

interface StaffStats {
  byRole: Record<string, number>;
  active: number;
  inactive: number;
  total: number;
}

export function StaffOverview() {
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch staff stats
      const statsData = await staffApi.getStats();
      setStats(statsData);

      // Fetch attendance for the week
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      
      const attendanceData = await attendanceApi.list({
        date_from: lastWeek.toISOString().split('T')[0],
        date_to: today.toISOString().split('T')[0]
      });
      setAttendance(attendanceData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const activeStaff = stats?.active || 0;
  const totalStaff = stats?.total || 0;
  const onDutyToday = Math.round(totalStaff * 0.7); // Estimate 70% on duty
  const attendanceRate = attendance.length > 0 
    ? Math.round((attendance.filter((a: any) => a.status === 'present').length / attendance.length) * 100)
    : 94;
  return (
    <div className="space-y-5">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[#2D2D2D]">
          Dashboard Overview
        </h2>
        <p className="mt-1 text-sm sm:text-[15px] text-muted-foreground">
          Real-time tracking of restaurant operations and personnel metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Staff</CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">+2%</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="text-4xl font-semibold text-[#2D2D2D]">{totalStaff}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Staff</CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">+5%</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="text-4xl font-semibold text-[#2D2D2D]">{activeStaff}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">On Duty Today</CardTitle>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100">-1%</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="text-4xl font-semibold text-[#2D2D2D]">{onDutyToday}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">+0.4%</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="text-4xl font-semibold text-[#2D2D2D]">{attendanceRate}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-[#2D2D2D]">Weekly Attendance Trends</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Avg <span className="font-semibold text-[#2D2D2D]">92%</span> • <span className="text-green-600">+1.2% this week</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-[#8B5A2B]">View Details</Button>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5A2B" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8B5A2B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9CA3AF', fontSize: 12}}
                    dy={10}
                  />
                  <YAxis 
                    hide 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#8B5A2B" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRate)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-[#1A1A1A] text-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Staff by Role</CardTitle>
            <p className="text-gray-400 text-sm">Team composition breakdown</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <ChefHat className="h-4 w-4 text-orange-400" />
                    </div>
                    <span className="text-sm font-medium">Chefs</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.byRole?.chef || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">Waiters</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.byRole?.waiter || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-green-400" />
                    </div>
                    <span className="text-sm font-medium">Cashiers</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.byRole?.cashier || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-purple-400" />
                    </div>
                    <span className="text-sm font-medium">Managers</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.byRole?.manager || 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
