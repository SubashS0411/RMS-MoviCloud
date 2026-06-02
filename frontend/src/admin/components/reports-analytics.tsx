import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Badge } from '@/admin/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/admin/components/ui/utils';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingBag,
  Users,
  Trophy,
  Clock,
  Calendar,
  Download,
  Star,
} from 'lucide-react';
import { analyticsApi } from '@/admin/utils/api';
import { LoadingReports } from '@/admin/components/ui/loading-spinner';
import { toast } from 'sonner';

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState('sales');
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, weeklyRes, dailyRes, staffRes] = await Promise.allSettled([
        analyticsApi.get(),
        analyticsApi.getWeekly(),
        analyticsApi.getDaily(),
        analyticsApi.getStaffPerformance(),
      ]);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
      if (weeklyRes.status === 'fulfilled') setWeeklyData(weeklyRes.value);
      if (dailyRes.status === 'fulfilled') setDailyData(dailyRes.value);
      if (staffRes.status === 'fulfilled') setStaffPerformance(staffRes.value ?? []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sales chart data — adapts to the selected time range
  const salesData = (() => {
    if (timeRange === 'today') {
      return (dailyData?.hourly ?? []).map((h: any) => ({
        name: formatHour(h.hour),
        sales: h.revenue ?? 0,
        orders: h.orders ?? 0,
      }));
    }
    const daily = weeklyData?.daily ?? [];
    if (timeRange === 'year') {
      // Aggregate daily buckets into monthly labels
      const monthMap = new Map<string, { sales: number; orders: number }>();
      daily.forEach((d: any) => {
        const dt = new Date(d.date);
        const key = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        const prev = monthMap.get(key) ?? { sales: 0, orders: 0 };
        monthMap.set(key, { sales: prev.sales + (d.revenue ?? 0), orders: prev.orders + (d.orders ?? 0) });
      });
      return Array.from(monthMap.entries()).map(([name, v]) => ({ name, ...v }));
    }
    return daily.map((d: any) => {
      const dt = new Date(d.date);
      const label = timeRange === 'month'
        ? dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        : `${DAY_NAMES[dt.getDay()]} ${dt.getDate()}`;
      return { name: label, sales: d.revenue ?? 0, orders: d.orders ?? 0 };
    });
  })();

  // Popular items from weekly top items (with revenue + trend from backend)
  const popularItems = (weeklyData?.topItems ?? []).map((item: any) => ({
    name: item.name,
    orders: item.count ?? 0,
    revenue: item.revenue ?? 0,
    trend: item.trend ?? 0,
  }));
  const maxOrders = popularItems.reduce((m: number, i: any) => Math.max(m, i.orders), 1);

  // Peak hours from daily hourly breakdown
  const peakHoursData = (() => {
    if (!dailyData?.hourly?.length) return [];
    const hourMap: Record<number, number> = {};
    dailyData.hourly.forEach((h: any) => { hourMap[h.hour] = h.orders; });
    return Array.from({ length: 16 }, (_, i) => {
      const hour = i + 7;
      return { hour: formatHour(hour), orders: hourMap[hour] ?? 0 };
    });
  })();
  const peakHour = peakHoursData.reduce(
    (best: any, cur: any) => (cur.orders > (best?.orders ?? 0) ? cur : best),
    null
  );
  const toPercentClass = (value: number) => `ds-w-pct-${Math.max(0, Math.min(100, Math.round(value)))}`;

  // Summary stats (all-time from main analytics endpoint — for customers, order types, occupancy)
  const stats = analytics?.data ?? {};
  const totalCustomers = stats.totalCustomers ?? 0;

  // Period-filtered stats — computed from the fetched range data
  const periodLabel = timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'This Year';
  const [totalRevenue, totalOrders] = (() => {
    if (timeRange === 'today') return [dailyData?.revenue ?? 0, dailyData?.orders ?? 0];
    const daily = weeklyData?.daily ?? [];
    return [
      daily.reduce((s: number, d: any) => s + (d.revenue ?? 0), 0),
      daily.reduce((s: number, d: any) => s + (d.orders ?? 0), 0),
    ];
  })();
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Category pie chart
  const categoryData = (stats.categoryDistribution ?? [])
    .slice(0, 6)
    .map((c: any, i: number) => ({ ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));

  // Order type quick status
  const orderTypes = stats.orderTypes ?? {};
  const dineIn = orderTypes['dine-in'] ?? orderTypes['dinein'] ?? 0;
  const takeaway = orderTypes['takeaway'] ?? orderTypes['pickup'] ?? 0;
  const delivery = orderTypes['delivery'] ?? 0;

  const escapeCsvCell = (value: string | number | null | undefined) => {
    const safeValue = value == null ? '' : String(value);
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const handleExportReport = () => {
    try {
      setExporting(true);

      const csvRows: string[] = [];

      csvRows.push('"Restaurant Management System - Reports Export"');
      csvRows.push(`"Generated At",${escapeCsvCell(new Date().toLocaleString())}`);
      csvRows.push(`"Time Range",${escapeCsvCell(timeRange)}`);
      csvRows.push('');

      csvRows.push('"SUMMARY"');
      csvRows.push('"Metric","Value"');
      csvRows.push(`"Total Revenue",${escapeCsvCell(totalRevenue)}`);
      csvRows.push(`"Total Orders",${escapeCsvCell(totalOrders)}`);
      csvRows.push(`"Average Order Value",${escapeCsvCell(Math.round(avgOrderValue))}`);
      csvRows.push(`"Total Customers",${escapeCsvCell(totalCustomers)}`);
      csvRows.push(`"Dine-in Orders",${escapeCsvCell(dineIn)}`);
      csvRows.push(`"Takeaway Orders",${escapeCsvCell(takeaway)}`);
      csvRows.push('');

      csvRows.push('"SALES TREND"');
      csvRows.push('"Day","Sales","Orders"');
      salesData.forEach((row: any) => {
        csvRows.push([
          escapeCsvCell(row.name),
          escapeCsvCell(row.sales ?? 0),
          escapeCsvCell(row.orders ?? 0),
        ].join(','));
      });
      csvRows.push('');

      csvRows.push('"POPULAR ITEMS"');
      csvRows.push('"Item Name","Orders","Revenue","Trend"');
      popularItems.forEach((item: any) => {
        csvRows.push([
          escapeCsvCell(item.name),
          escapeCsvCell(item.orders ?? 0),
          escapeCsvCell(item.revenue ?? 0),
          escapeCsvCell(item.trend ?? 0),
        ].join(','));
      });
      csvRows.push('');

      csvRows.push('"PEAK HOURS"');
      csvRows.push('"Hour","Orders"');
      peakHoursData.forEach((row: any) => {
        csvRows.push([
          escapeCsvCell(row.hour),
          escapeCsvCell(row.orders ?? 0),
        ].join(','));
      });
      csvRows.push('');

      csvRows.push('"STAFF PERFORMANCE"');
      csvRows.push('"Rank","Name","Role","Orders Handled","Avg Service Time","Attendance","Score"');
      staffPerformance.forEach((staff: any, index: number) => {
        csvRows.push([
          escapeCsvCell(index + 1),
          escapeCsvCell(staff.name ?? ''),
          escapeCsvCell(staff.role ?? ''),
          escapeCsvCell(staff.orders_handled ?? 0),
          escapeCsvCell(staff.avg_service_time ?? ''),
          escapeCsvCell(staff.attendance ?? ''),
          escapeCsvCell(staff.performance_score ?? ''),
        ].join(','));
      });

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = new Date().toISOString().split('T')[0];

      link.href = url;
      link.download = `reports-export-${dateStamp}.csv`;
      link.click();

      window.URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Failed to export report:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingReports />;
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">
      {/* Top Bar: Tabs (left) + Filters (right) */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <nav className="flex items-center gap-2 min-w-max">
            {[
              { id: 'sales', label: 'Sales', icon: TrendingUp, description: 'Revenue & orders' },
              { id: 'items', label: 'Popular Items', icon: ShoppingBag, description: 'Top performing dishes' },
              { id: 'peak', label: 'Peak Hours', icon: Clock, description: 'Busy time analysis' },
              { id: 'staff', label: 'Staff', icon: Users, description: 'Employee performance' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.description}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[#e8f0ff] border-[#c9d9ff] text-[#2D2D2D]'
                      : 'bg-white border-[#e7ded4] text-[#4f4f4f] hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-[#2D2D2D]' : 'text-muted-foreground')} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-10 w-36 sm:w-40 bg-white text-gray-700 border border-[#e7ded4] hover:bg-gray-50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-10 bg-white text-gray-700 border border-[#e7ded4] hover:bg-gray-50 shadow-sm"
            onClick={handleExportReport}
            disabled={loading || exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Sales Reports Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">INR {totalRevenue.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">{periodLabel} — completed orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {periodLabel} · {stats.activeOrders ?? 0} active now
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">INR {Math.round(avgOrderValue).toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">Per completed order</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered customers</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>
                {timeRange === 'today'
                  ? 'Hourly orders & revenue for today'
                  : `Daily sales — ${weeklyData?.startDate ?? ''} to ${weeklyData?.endDate ?? ''} (${periodLabel})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No sales data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(val: any, name: string) => name === 'Sales (INR)' ? `INR ${val.toLocaleString('en-IN')}` : val} />
                    <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Sales (INR)" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
                <CardDescription>Order distribution across menu categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                    No category data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name} (${entry.value})`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {categoryData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Type Breakdown</CardTitle>
                <CardDescription>Distribution by order type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Dine-in Orders</span>
                  </div>
                  <span className="font-semibold">
                    {dineIn > 0 ? `${dineIn} (${totalOrders > 0 ? Math.round((dineIn / totalOrders) * 100) : 0}%)` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Takeaway Orders</span>
                  </div>
                  <span className="font-semibold">
                    {takeaway > 0 ? `${takeaway} (${totalOrders > 0 ? Math.round((takeaway / totalOrders) * 100) : 0}%)` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Table Occupancy</span>
                  </div>
                  <span className="font-semibold">{stats.tableOccupancy ?? 0}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Popular Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <CardDescription>Most popular dishes — {periodLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {popularItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No item data available for this period</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="text-right">Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popularItems.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {index < 3 ? (
                            <Trophy className={`h-5 w-5 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-700'}`} />
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.orders}</TableCell>
                        <TableCell>{item.revenue > 0 ? `INR ${item.revenue.toLocaleString('en-IN')}` : '-'}</TableCell>
                        <TableCell>
                          {item.trend > 0 ? (
                            <Badge className="bg-green-500">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {item.trend}%
                            </Badge>
                          ) : item.trend < 0 ? (
                            <Badge className="bg-red-500">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              {Math.abs(item.trend)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                              0%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-primary ${toPercentClass((item.orders / maxOrders) * 100)}`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {Math.round((item.orders / maxOrders) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {popularItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Items Chart</CardTitle>
                <CardDescription>Visual comparison of order volumes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={popularItems}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#3b82f6" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Peak Hours Tab */}
        <TabsContent value="peak" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Analysis</CardTitle>
              <CardDescription>Order distribution throughout today</CardDescription>
            </CardHeader>
            <CardContent>
              {peakHoursData.length === 0 ? (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
                  No hourly data available for today
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={peakHoursData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#8b5cf6" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Peak Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {peakHour ? peakHour.hour : '-'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {peakHour ? `${peakHour.orders} orders during this hour` : 'No data yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {dailyData?.orders ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  INR {(dailyData?.revenue ?? 0).toLocaleString('en-IN')} revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completed Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {dailyData?.completed ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  of {dailyData?.orders ?? 0} total orders
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Performance Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance Ranking</CardTitle>
              <CardDescription>Employee performance metrics and ratings</CardDescription>
            </CardHeader>
            <CardContent>
              {staffPerformance.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No performance data recorded yet. Log staff performance from the Staff module.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Orders Handled</TableHead>
                      <TableHead>Avg. Service Time</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffPerformance.map((staff: any, index: number) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          {index < 3 ? (
                            <Trophy className={`h-5 w-5 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-700'}`} />
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{staff.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{staff.role}</Badge>
                        </TableCell>
                        <TableCell>{staff.orders_handled ?? 0}</TableCell>
                        <TableCell>{staff.avg_service_time ?? '-'}</TableCell>
                        <TableCell>
                          {staff.attendance && staff.attendance !== '-' ? (
                            <Badge className={staff.attendance === '100%' ? 'bg-green-500' : 'bg-blue-500'}>
                              {staff.attendance}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {staff.performance_score != null ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-green-500 ${toPercentClass(staff.performance_score)}`}
                                />
                              </div>
                              <span className="font-semibold w-8 text-right">{staff.performance_score}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
