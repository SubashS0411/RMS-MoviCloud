import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { IndianRupee, ShoppingCart, TrendingUp, Users, AlertCircle, Activity, Package, ChefHat, UserCog, Clock, Radio } from 'lucide-react';
import { API_BASE_URL } from '@/admin/utils/api';
import { Alert, AlertDescription, AlertTitle } from '@/admin/components/ui/alert';
import { Button } from '@/admin/components/ui/button';
import { Badge } from '@/admin/components/ui/badge';
import { LoadingSpinner } from '@/admin/components/ui/loading-spinner';

interface Analytics {
  totalOrders: number;
  completedOrders: number;
  invoiceCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  popularItems: Array<{ 
    name: string; 
    count: number;
    revenue: number;
    avgPrepTime: number;
  }>;
  tableOccupancy: number;
  activeOrders: number;
  // Staff data
  totalStaff: number;
  onDutyStaff: number;
  onLeaveStaff: number;
}

export function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 10000); // Refresh every 10 seconds for live updates
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/analytics`,
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
    } catch (error) {
      // Silently handle error and use default data
      if (!analytics) {
        setAnalytics({
          totalOrders: 0,
          completedOrders: 0,
          invoiceCount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          popularItems: [],
          tableOccupancy: 0,
          activeOrders: 0,
          totalStaff: 0,
          onDutyStaff: 0,
          onLeaveStaff: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const toPercentClass = (value: number) => `ds-w-pct-${Math.max(0, Math.min(100, Math.round(value)))}`;
  const dashboardCardClass = 'rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-0.5';

  return (
    <div className="min-h-screen p-4 sm:p-5 space-y-3 sm:space-y-4 max-w-full overflow-x-hidden bg-[#f8f6f3] text-[#2c2c2c]">
      {/* Header with Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-[#6c665d]">Restaurant management overview</p>
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-[#ece5dc] shadow-[0_4px_12px_rgba(0,0,0,0.06)] self-start">
          <Radio className="h-4 w-4 text-green-600 animate-pulse" />
          <div className="text-sm">
            <span className="font-medium text-green-600">Live status</span>
            <span className="text-muted-foreground"> • Auto updated</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}. The system may not be fully connected.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              className="ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - Row 1: Financial & Orders */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm sm:text-[15px] font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">₹{(analytics?.totalRevenue ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.invoiceCount || 0} invoices made
            </p>
          </CardContent>
        </Card>

        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm sm:text-[15px] font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{analytics?.activeOrders || 0}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm sm:text-[15px] font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">₹{(analytics?.avgOrderValue ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per completed order</p>
          </CardContent>
        </Card>

        <Card className={dashboardCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm sm:text-[15px] font-medium">Table Occupancy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{(analytics?.tableOccupancy ?? 0).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Current capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Row 2: Staff Status */}
      <div className="grid gap-4 md:grid-cols-1">
        {/* Staff Status Card */}
        <Card className={`${dashboardCardClass} border-l-2 border-l-[#8B5E3C]`}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-[15px] font-semibold text-[#2c2c2c]">Staff Status</CardTitle>
              <UserCog className="h-4 w-4 text-[#8B5E3C]" />
            </div>
            <CardDescription>Workforce summary linked to Staff Management</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Workers</span>
              <span className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{analytics?.totalStaff || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  On Duty
                </Badge>
              </div>
              <span className="text-lg sm:text-xl font-bold text-green-700">{analytics?.onDutyStaff || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                  On Leave
                </Badge>
              </div>
              <span className="text-lg sm:text-xl font-bold text-orange-700">{analytics?.onLeaveStaff || 0}</span>
            </div>
            {/* Progress Bar */}
            <div className="pt-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-green-600 transition-all duration-500 ${toPercentClass(analytics?.totalStaff ? (analytics.onDutyStaff / analytics.totalStaff) * 100 : 0)}`}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {analytics?.totalStaff ? Math.round((analytics.onDutyStaff / analytics.totalStaff) * 100) : 0}% workforce active
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Popular Menu Items & Order Statistics */}
      <div className="grid gap-4 md:grid-cols-2 w-full min-w-0">
        {/* Enhanced Popular Menu Items */}
        <Card className={`col-span-1 md:col-span-2 overflow-hidden ${dashboardCardClass}`}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-[15px] text-[#2c2c2c]">Popular Menu Items</CardTitle>
                <CardDescription>Top 5 most ordered items linked to Orders module</CardDescription>
              </div>
              <Badge variant="outline" className="text-[#8B5E3C] border-[#8B5E3C]">
                Live Updates
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {analytics?.popularItems && analytics.popularItems.length > 0 ? (
              <div className="space-y-4">
                {/* Bar Chart */}
                <ResponsiveContainer width="99%" height={220}>
                  <BarChart data={analytics.popularItems}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-15}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'count') return [value, 'Orders'];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="count" fill="#8B5A2B" radius={[8, 8, 0, 0]}>
                      {analytics.popularItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${30 - index * 5}, 50%, ${45 + index * 5}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Detailed Table */}
                <div className="border border-[#ece5dc] rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[400px]">
                    <thead className="bg-[#F7F3EE]">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-black">Item Name</th>
                        <th className="text-center p-3 text-sm font-semibold text-black">Orders</th>
                        <th className="text-center p-3 text-sm font-semibold text-black">Revenue</th>
                        <th className="text-center p-3 text-sm font-semibold text-black">Avg Prep Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.popularItems.map((item, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-black">
                                {index + 1}. {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="font-semibold">
                              {item.count || 0}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-semibold text-[#8B5E3C]">
                            ₹{(item.revenue ?? 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {item.avgPrepTime || 0} min
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-2" />
                <p>No orders yet. Popular items will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Statistics */}
        <Card className={dashboardCardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm sm:text-[15px] text-[#2c2c2c]">Order Statistics</CardTitle>
            <CardDescription>Overview of order processing</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Orders</span>
              <span className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{analytics?.invoiceCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completed</span>
              <span className="text-xl sm:text-2xl font-bold text-green-600">{analytics?.completedOrders || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">In Progress</span>
              <span className="text-xl sm:text-2xl font-bold text-blue-600">{analytics?.activeOrders || 0}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-green-600 transition-all duration-500 ${toPercentClass(analytics?.invoiceCount ? Math.min((analytics.completedOrders / analytics.invoiceCount) * 100, 100) : 0)}`}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {analytics?.invoiceCount ? Math.round((analytics.completedOrders / analytics.invoiceCount) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}